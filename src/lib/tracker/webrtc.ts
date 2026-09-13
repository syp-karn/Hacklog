/**
 * WebRTC ICE gathering — surfaces the LAN IP and (behind some VPNs) the real
 * public IP, because ICE talks UDP to STUN servers directly, a path many VPN
 * clients never intercept. Ported from the "cookie" reference site's probe.
 *
 * User explicitly opted into collecting this. Parse results defensively:
 * modern Chrome masks local IPs behind mDNS .local names.
 */

import type { Probe, Signal } from './types';
import { hash, sig } from './util';

const STUN_SERVERS = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];
const GATHER_TIMEOUT_MS = 3000;

const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const IPV6_RE = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/i;
const MDNS_RE = /\b[0-9a-f-]+\.local\b/i;

function isPrivateOrLinkLocal(ip: string): boolean {
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^fe80:/i.test(ip)) return true;
  return false;
}

interface ParsedCandidate {
  ip: string | null;
  mdns: boolean;
  type: string | null;
}

function parseCandidate(candidateStr: string): ParsedCandidate {
  const mdnsMatch = candidateStr.match(MDNS_RE);
  if (mdnsMatch) return { ip: mdnsMatch[0], mdns: true, type: parseType(candidateStr) };
  const v4 = candidateStr.match(IPV4_RE);
  const v6 = !v4 ? candidateStr.match(IPV6_RE) : null;
  const ip = v4?.[0] ?? v6?.[0] ?? null;
  return { ip, mdns: false, type: parseType(candidateStr) };
}

function parseType(candidateStr: string): string | null {
  const m = candidateStr.match(/\styp\s+(\w+)/);
  return m ? m[1] : null;
}

export const webrtcProbe: Probe = {
  id: 'webrtc',
  title: 'WebRTC leak',
  tier: 1,
  async run() {
    const RTCPC = (globalThis as typeof globalThis & {
      RTCPeerConnection?: typeof RTCPeerConnection;
    }).RTCPeerConnection;

    if (!RTCPC) {
      return [
        sig('webrtc.localIPs', 'Local IPs leaked', [], { error: 'RTCPeerConnection unavailable' }),
        sig('webrtc.publicIP', 'Public IP leaked', null),
        sig('webrtc.mdnsProtected', 'mDNS local-IP protection', false),
      ];
    }

    let pc: RTCPeerConnection | null = null;

    try {
      pc = new RTCPC({ iceServers: [{ urls: STUN_SERVERS }] });

      // A data channel just gives ICE something to gather candidates for —
      // without it Chrome may skip gathering entirely for an empty offer.
      pc.createDataChannel('probe');

      const candidateStrings: string[] = [];
      const gatherDone = new Promise<void>((resolve) => {
        const finish = () => resolve();
        const timeoutId = setTimeout(finish, GATHER_TIMEOUT_MS);
        pc!.onicecandidate = (ev) => {
          if (!ev.candidate) { clearTimeout(timeoutId); finish(); return; }
          candidateStrings.push(ev.candidate.candidate);
        };
        pc!.onicegatheringstatechange = () => {
          if (pc!.iceGatheringState === 'complete') { clearTimeout(timeoutId); finish(); }
        };
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await gatherDone;

      const sdp = pc.localDescription?.sdp ?? '';

      // Merge event candidates with anything in the final SDP (belt and braces).
      const sdpCandidateLines = sdp.split('\n').filter((l) => l.startsWith('a=candidate'));
      const all = [...new Set([...candidateStrings, ...sdpCandidateLines])];
      const parsed = all.map(parseCandidate);

      const localIPs = [...new Set(
        parsed.filter((p) => p.ip && !p.mdns && isPrivateOrLinkLocal(p.ip)).map((p) => p.ip as string),
      )];
      const publicIPs = [...new Set(
        parsed.filter((p) => p.ip && !p.mdns && !isPrivateOrLinkLocal(p.ip)).map((p) => p.ip as string),
      )];
      const mdnsProtected = parsed.some((p) => p.mdns);

      // Codec/extension fingerprint: independent of IP, from what the offer negotiates.
      const fingerprintLines = sdp
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('a=extmap:') || l.startsWith('a=rtpmap:') || l.startsWith('a=fmtp:'))
        .sort();
      const sdpHash = fingerprintLines.length ? hash(fingerprintLines.join('\n')) : null;

      return [
        sig('webrtc.localIPs', 'Local IPs leaked', localIPs, {
          display: localIPs.length ? localIPs.join(', ') : 'none (mDNS-protected or none found)',
        }),
        sig('webrtc.publicIP', 'Public IP leaked', publicIPs[0] ?? null),
        sig('webrtc.mdnsProtected', 'mDNS local-IP protection', mdnsProtected),
        sig('webrtc.candidateTypes', 'ICE candidate types seen',
          [...new Set(parsed.map((p) => p.type).filter((t): t is string => t !== null))]),
        sig('webrtc.sdpHash', 'SDP codec fingerprint', sdpHash),
      ];
    } catch (e) {
      return [
        sig('webrtc.localIPs', 'Local IPs leaked', [], { error: String(e) }),
        sig('webrtc.publicIP', 'Public IP leaked', null),
        sig('webrtc.mdnsProtected', 'mDNS local-IP protection', false),
      ];
    } finally {
      pc?.close();
    }
  },
};
