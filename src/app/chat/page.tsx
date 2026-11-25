
"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type Message = {
  text: string;
  mine: boolean;
};

function getBrowserId(): string {
  const storageKey = "talk-anyone-browser-id";

  try {
    const existing = window.localStorage.getItem(storageKey);

    if (
      existing &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(existing)
    ) {
      return existing;
    }

    const id = window.crypto.randomUUID();
    window.localStorage.setItem(storageKey, id);
    return id;
  } catch {
    return window.crypto.randomUUID();
  }
}

export default function Home() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [status, setStatus] = useState("Ready to meet someone?");
  const [messages, setMessages] = useState<Message[]>([]);

  // TALK_ANYONE_UNREAD_INDICATOR_V1
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [tabUnreadMessages, setTabUnreadMessages] = useState(0);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatShouldScrollRef = useRef(true);

  const [messageInput, setMessageInput] = useState("");

  const chatSessionRef = useRef(0);
  const messagePendingRef = useRef(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportPending, setReportPending] = useState(false);

  // TALK_ANYONE_CHAT_AUTOSCROLL_V1
  useEffect(() => {
    const box = chatScrollRef.current;

    if (box && chatShouldScrollRef.current) {
      box.scrollTop = box.scrollHeight;
    }
  }, [messages]);

  // TALK_ANYONE_TAB_BADGE_V1
  useEffect(() => {
    const count = unreadMessages + tabUnreadMessages;

    document.title =
      count > 0
        ? `(${count}) TALK ANYONE`
        : "TALK ANYONE";

    return () => {
      document.title = "TALK ANYONE";
    };
  }, [unreadMessages, tabUnreadMessages]);

  useEffect(() => {
    const clearWhenVisible = () => {
      if (!document.hidden) {
        setTabUnreadMessages(0);
      }
    };

    document.addEventListener(
      "visibilitychange",
      clearWhenVisible
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        clearWhenVisible
      );
    };
  }, []);

  function closePeer() {
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    pendingCandidatesRef.current = [];

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }

  async function createPeer() {
    if (peerRef.current) return peerRef.current;

    // START METERED TURN - request ICE servers through our Socket.IO backend.
    const fallbackIceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
    let iceServers: RTCIceServer[] = fallbackIceServers;
    const currentSocket = socketRef.current;

    if (currentSocket?.connected) {
      const meteredServers = await new Promise<RTCIceServer[]>((resolve) => {
        currentSocket.timeout(8000).emit(
          "get-ice-servers",
          (error: Error | null, response?: { iceServers?: RTCIceServer[] }) => {
            if (error || !Array.isArray(response?.iceServers)) {
              resolve([]);
            } else {
              resolve(response.iceServers);
            }
          }
        );
      });
      if (meteredServers.length > 0) {
        iceServers = [...meteredServers, ...fallbackIceServers];
      }
    }

    // A second createPeer() call may have completed during the TURN lookup.
    if (peerRef.current) return peerRef.current;
    const peer = new RTCPeerConnection({ iceServers });
    // END METERED TURN

    peerRef.current = peer;

    const localStream = localStreamRef.current;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peer.addTrack(track, localStream);
      });
    }

    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", event.candidate);
      }
    };

    return peer;
  }

  async function addPendingCandidates() {
    const peer = peerRef.current;

    if (!peer || !peer.remoteDescription) return;

    const candidates = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("ICE candidate error:", error);
      }
    }
  }

  async function startChat() {
    if (!acceptedRules) {
      alert("Please accept the safety rules first.");
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    try {
      setStatus("Turning on your camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setCameraOn(true);
      setMicOn(true);

      const socket = io(
        process.env.NODE_ENV === "development"
          ? "http://localhost:3001"
          : "https://talk-anyone-5mlu.onrender.com",
        { auth: { browserId: getBrowserId() } }
      );
      socketRef.current = socket;

      socket.on("chat-error", (message: string) => {
        setStatus(message);
      });

      socket.on("connect", () => {
        setStatus("Finding someone...");
        setIsSearching(true);
        socket.emit("find-partner");
      });

      socket.on("waiting", () => {
        closePeer();
        setPartnerConnected(false);
        setIsSearching(true);
        setStatus("Waiting for someone to join...");
      });

      socket.on("partner-found", async ({ initiator }) => {
        closePeer();
        chatSessionRef.current += 1;
        messagePendingRef.current = false;
        chatShouldScrollRef.current = true;
        setUnreadMessages(0);
        setTabUnreadMessages(0);
        setMessages([]);
        setPartnerConnected(true);
        setReportOpen(false);
        setIsSearching(false);
        setStatus("You are connected! Say hello.");

        if (initiator) {
          try {
            const peer = await createPeer();
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socket.emit("webrtc-offer", offer);
          } catch (error) {
            console.error("Offer error:", error);
            setStatus("Could not start video. Please try Next.");
          }
        }
      });

      socket.on("webrtc-offer", async (offer) => {
        try {
          const peer = await createPeer();
          await peer.setRemoteDescription(
            new RTCSessionDescription(offer)
          );

          await addPendingCandidates();

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit("webrtc-answer", answer);
        } catch (error) {
          console.error("Answer error:", error);
        }
      });

      socket.on("webrtc-answer", async (answer) => {
        try {
          const peer = peerRef.current;
          if (!peer) return;

          await peer.setRemoteDescription(
            new RTCSessionDescription(answer)
          );

          await addPendingCandidates();
        } catch (error) {
          console.error("Remote answer error:", error);
        }
      });

      socket.on("ice-candidate", async (candidate) => {
        const peer = peerRef.current;

        if (!peer || !peer.remoteDescription) {
          pendingCandidatesRef.current.push(candidate);
          return;
        }

        try {
          await peer.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (error) {
          console.error("ICE candidate error:", error);
        }
      });

      socket.on("chat-message", (message: string) => {
        if (document.hidden && chatShouldScrollRef.current) {
          setTabUnreadMessages((count) => count + 1);
        }

        if (!chatShouldScrollRef.current) {
          setUnreadMessages((count) => count + 1);
        }

        setMessages((previous) => [
          ...previous,
          { text: message, mine: false },
        ]);
      });

      // TALK_ANYONE_TAB_RESET_V1
      socket.on("partner-left", () => {
        setTabUnreadMessages(0);
        chatShouldScrollRef.current = true;
        setUnreadMessages(0);
        chatSessionRef.current += 1;
        messagePendingRef.current = false;
        closePeer();
        setPartnerConnected(false);
        setIsSearching(false);
        setStatus("Your partner left. Press Next to find someone else.");
      });

      socket.on("user-blocked", () => {
        closePeer();
        setPartnerConnected(false);
        setIsSearching(false);
        setStatus("This user has been blocked.");
      });

      socket.on("blocked-by-partner", () => {
        closePeer();
        setPartnerConnected(false);
        setIsSearching(false);
        setStatus("Your partner has disconnected.");
      });

      socket.on("match-error", (message: string) => {
        setStatus(message);
      });

      socket.on("connect_error", (error) => {
        console.error("Connection error:", error);
        setStatus("Could not connect to the server. Check that it is running.");
      });
    } catch (error) {
      console.error("Camera error:", error);
      setStatus("Camera or microphone permission denied. Please allow access.");
    }
  }

  function sendMessage() {
    const text = messageInput.trim();
    const socket = socketRef.current;

    if (
      !text ||
      !partnerConnected ||
      !socket?.connected ||
      messagePendingRef.current
    ) {
      return;
    }

    messagePendingRef.current = true;
    const session = chatSessionRef.current;

    socket.timeout(5000).emit(
      "chat-message",
      text,
      (
        error: Error | null,
        response?: { ok: boolean; message?: string }
      ) => {
        if (chatSessionRef.current !== session) {
          return;
        }

        messagePendingRef.current = false;

        if (error) {
          setStatus(
            "Message not confirmed. Check your connection."
          );
          return;
        }

        if (!response?.ok) {
          setStatus(
            response?.message || "Message was not sent."
          );
          return;
        }

        setMessages((previous) => [
          ...previous,
          { text, mine: true },
        ]);

        setMessageInput((current) =>
          current.trim() === text ? "" : current
        );
      }
    );
  }

  function nextPartner() {
    if (!socketRef.current?.connected) {
      setStatus("Press Start to begin chatting.");
      return;
    }

    closePeer();
    chatSessionRef.current += 1;
    messagePendingRef.current = false;
    chatShouldScrollRef.current = true;
    setUnreadMessages(0);
    setTabUnreadMessages(0);
    setMessages([]);
    setPartnerConnected(false);
    setIsSearching(true);
    setStatus("Finding your next partner...");

    socketRef.current.emit("next-partner");
  }

  function stopChat() {
    closePeer();

    socketRef.current?.disconnect();
    socketRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setPartnerConnected(false);
    setIsSearching(false);
    setCameraOn(false);
    setMicOn(false);
    chatSessionRef.current += 1;
    messagePendingRef.current = false;
    chatShouldScrollRef.current = true;
    setUnreadMessages(0);
    setTabUnreadMessages(0);
    setMessages([]);
    setMessageInput("");
    setStatus("Chat stopped. Press Start when you're ready.");
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;

    const newState = !cameraOn;

    stream.getVideoTracks().forEach((track) => {
      track.enabled = newState;
    });

    setCameraOn(newState);
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;

    const newState = !micOn;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = newState;
    });

    setMicOn(newState);
  }

  function submitReport() {
    const socket = socketRef.current;
    if (!socket?.connected || !partnerConnected || reportPending) return;

    setReportPending(true);
    socket.timeout(10000).emit(
      "report-user",
      { reason: reportReason },
      (error: Error | null, reply?: { ok: boolean; message: string }) => {
        setReportPending(false);
        if (error || !reply?.ok) {
          setStatus(reply?.message || "Report could not be sent. Try again.");
          return;
        }
        setReportOpen(false);
        setStatus("Report received. Thank you for helping keep TALK ANYONE safe.");
      }
    );
  }

  function blockUser() {
    if (!partnerConnected) return;

    const confirmed = window.confirm(
      "Are you sure you want to block this person?"
    );

    if (!confirmed) return;

    closePeer();
    setPartnerConnected(false);
    chatSessionRef.current += 1;
    messagePendingRef.current = false;
    chatShouldScrollRef.current = true;
    setUnreadMessages(0);
    setTabUnreadMessages(0);
    setMessages([]);
    setStatus("Blocking this user...");

    socketRef.current?.emit("block-user");
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();

      localStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      peerRef.current?.close();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#F7F5EE] text-[#202824]">
      {/* Friendly, compact navigation */}
      <header className="border-b border-[#202824]/10 bg-[#F7F5EE]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight sm:text-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#202824] text-lg text-[#D9EFAB]">✳</span>
            talk anyone<span className="-ml-2 text-[#718F5A]">.</span>
          </a>
          <div className="flex items-center gap-3 text-xs font-semibold sm:gap-6 sm:text-sm">
            <a href="/" className="rounded-full px-3 py-2 transition hover:bg-[#E8E9DC]">← Back home</a>
            <a href="/login" className="hidden rounded-full border border-[#202824]/15 px-4 py-2 transition hover:bg-white sm:inline-flex">Log in</a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-3 pb-16 pt-8 sm:px-8 sm:pt-12">
        <div className="mb-6 flex flex-col gap-3 sm:mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.19em] text-[#718F5A]">A space to connect</p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Take a seat. Say hello.</h1>
          <p className="max-w-2xl text-sm leading-6 text-[#687168] sm:text-base">
            Everyone starts as a stranger. Sometimes a simple hello is all it takes.
          </p>
        </div>

        <div role="status" aria-live="polite" className="mb-5 flex items-start gap-3 rounded-2xl border border-[#DDE1D4] bg-[#EBF0E2] px-4 py-3 sm:px-5">
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${partnerConnected ? "bg-[#4F8D54]" : isSearching ? "animate-pulse bg-[#B58C36]" : "bg-[#8E9B89]"}`} />
          <div>
            <p className="text-sm font-semibold text-[#334535]">{status}</p>
            {isSearching && <p className="mt-1 text-xs text-[#647461]">Looking for someone who's ready to talk...</p>}
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          {/* VIDEO + CONTROLS */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[28px] bg-[#202824] text-white shadow-xl shadow-[#202824]/10">
              <div className="flex items-center justify-between gap-2 px-4 py-4 sm:px-5">
                <div>
                  <h2 className="font-bold">Your conversation</h2>
                  <p className="mt-0.5 text-xs text-[#BCC9BB]">A new perspective, one hello away</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-[#E4F2D3]">
                  {partnerConnected ? "● Connected" : isSearching ? "● Finding someone" : "● Not connected"}
                </span>
              </div>

              <div className="relative bg-[#121914]">
                <div className="relative aspect-[4/5] overflow-hidden sm:aspect-video">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  {!partnerConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#253329] px-10 text-center text-[#E0EBDD]">
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 text-4xl">✳</div>
                      <p className="text-xl font-bold">Someone new is out there.</p>
                      <p className="mt-2 max-w-xs text-sm leading-6 text-[#C6D4C4]">Start chatting when you're ready. No pressure, just conversation.</p>
                    </div>
                  )}
                </div>

                {/* Keep local video mounted so the existing camera ref keeps working. */}
                <div className="absolute bottom-4 right-4 z-10 w-[36%] min-w-[112px] max-w-[190px] overflow-hidden rounded-2xl border-[3px] border-white/80 bg-[#101710] shadow-2xl sm:bottom-5 sm:right-5">
                  <div className="relative aspect-[3/4] bg-[#101710] sm:aspect-video">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    {!cameraOn && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#28332C] px-2 text-center text-xs text-white/80">Camera is off</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between bg-[#1B2920] px-3 py-2 text-[11px] font-semibold">
                    <span>You</span><span className="text-[#D9EFAB]">●</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 sm:p-4">
                <button
                  type="button"
                  onClick={toggleCamera}
                  disabled={!localStreamRef.current}
                  className="min-h-12 touch-manipulation rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9EFAB] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {cameraOn ? "📷 Camera on" : "📷 Camera off"}
                </button>
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={!localStreamRef.current}
                  className="min-h-12 touch-manipulation rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9EFAB] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {micOn ? "🎤 Mic on" : "🔇 Mic off"}
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#E4E2D7] bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">You're in control</h2>
                <span className="text-xs text-[#748074]">Take it at your own pace</span>
              </div>
              {/* TALK_ANYONE_SAFETY_GATE_V1: voluntary age declaration, not identity verification */}
              <div className="mb-5 rounded-2xl border border-[#CDDDBF] bg-[#F2F7E9] p-4">
                <label htmlFor="talk-anyone-adult-rules" className="flex cursor-pointer items-start gap-3">
                  <input
                    id="talk-anyone-adult-rules"
                    type="checkbox"
                    checked={acceptedRules}
                    onChange={(event) => setAcceptedRules(event.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 accent-[#567A4B]"
                  />
                  <span>
                    <span className="block text-sm font-bold text-[#293B2A]">
                      I confirm I am 18 or older and agree to follow the safety rules.
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#586957]">
                      Treat others with respect. No harassment, threats, or sexual content.
                      Keep private information private. You can leave, block, or report.
                    </span>
                  </span>
                </label>
                <p className="mt-3 text-xs leading-5 text-[#61705E]">
                  Please read our{" "}
                  <a href="/community-guidelines" className="font-semibold underline underline-offset-2">
                    Community Guidelines
                  </a>{" "}
                  and{" "}
                  <a href="/terms" className="font-semibold underline underline-offset-2">
                    Terms of Use
                  </a>.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                <button
                  type="button"
                  onClick={startChat}
                  disabled={!acceptedRules || !!socketRef.current?.connected || isSearching || partnerConnected}
                  className="min-h-12 touch-manipulation rounded-xl bg-[#202824] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3E5142] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527A4F] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ✳ Start chat
                </button>
                <button
                  type="button"
                  onClick={nextPartner}
                  disabled={!socketRef.current?.connected}
                  className="min-h-12 touch-manipulation rounded-xl bg-[#D9EFAB] px-4 py-3 text-sm font-bold text-[#202824] transition hover:bg-[#C4E792] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527A4F] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next person ↗
                </button>
                <button
                  type="button"
                  onClick={stopChat}
                  className="col-span-2 min-h-12 touch-manipulation rounded-xl border border-[#D7DAD0] bg-[#F4F4EF] px-4 py-3 text-sm font-bold text-[#5C3331] transition hover:bg-[#F3E4E2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527A4F] sm:col-span-1"
                >
                  Stop chat
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEDE7] pt-4">
                <p className="text-xs text-[#768076]">Not comfortable? You can leave or report someone.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={blockUser}
                    disabled={!partnerConnected}
                    className="min-h-10 rounded-full border border-[#E3D7D1] px-4 py-2 text-xs font-bold text-[#7B4B3E] hover:bg-[#FBF1ED] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Block
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    disabled={!partnerConnected}
                    className="min-h-10 rounded-full border border-[#E3D7D1] px-4 py-2 text-xs font-bold text-[#7B4B3E] hover:bg-[#FBF1ED] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Report
                  </button>
                </div>
              </div>
            </div>

            {reportOpen && partnerConnected && (
              <div className="rounded-[24px] border border-[#DEC7A6] bg-[#FFF9EE] p-5">
                <h3 className="text-lg font-bold">Report this person</h3>
                <p className="mt-2 text-sm text-[#716959]">Choose a reason. Reporting doesn't automatically block the person.</p>
                <label htmlFor="report-reason" className="mt-4 block text-sm font-semibold">Reason</label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#D9C9AB] bg-white p-3 text-[#202824]"
                >
                  <option value="harassment">Harassment or bullying</option>
                  <option value="inappropriate-content">Inappropriate content</option>
                  <option value="spam">Spam or advertising</option>
                  <option value="hate-speech">Hate speech or threats</option>
                  <option value="other">Other</option>
                </select>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={submitReport}
                    disabled={reportPending}
                    className="min-h-11 rounded-xl bg-[#202824] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {reportPending ? "Sending..." : "Submit report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    disabled={reportPending}
                    className="min-h-11 rounded-xl border border-[#D9C9AB] px-5 py-3 text-sm font-bold disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-[20px] border border-[#DDE3D5] bg-[#ECF1E5] p-4 sm:p-5">
              <input
                type="checkbox"
                checked={acceptedRules}
                onChange={(event) => setAcceptedRules(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#53784C]"
              />
              <span className="text-sm leading-6 text-[#425244]">
                <strong>Keep it respectful.</strong> I agree not to share harmful, abusive, or inappropriate content with others.
              </span>
            </label>
          </div>

          {/* TEXT CHAT — retains existing send/unread/autoscroll behavior */}
          <aside className="flex min-w-0 flex-col rounded-[28px] border border-[#E4E2D7] bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#EEEDE8] pb-4">
              <div>
                <h2 className="text-xl font-extrabold">Messages</h2>
                <p className="mt-1 text-xs text-[#7A8478]">Be kind. Be curious.</p>
              </div>
              {unreadMessages > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    chatShouldScrollRef.current = true;
                    const box = chatScrollRef.current;
                    if (box) box.scrollTop = box.scrollHeight;
                    setUnreadMessages(0);
                  }}
                  className="min-h-10 rounded-full bg-[#D9EFAB] px-3 py-2 text-xs font-semibold text-[#202824] hover:bg-[#C4E792]"
                >
                  ↓ {unreadMessages} new {unreadMessages === 1 ? "message" : "messages"}
                </button>
              )}
            </div>
            <div
              ref={chatScrollRef}
              onScroll={(event) => {
                const box = event.currentTarget;
                chatShouldScrollRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < 100;
                if (chatShouldScrollRef.current) setUnreadMessages(0);
              }}
              className="mb-4 h-80 space-y-3 overflow-y-auto rounded-2xl bg-[#F2F1EB] p-3 sm:h-[450px] sm:p-4 lg:h-[510px]"
            >
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center text-[#768275]">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl">💬</div>
                  <p className="text-sm font-semibold text-[#465548]">A conversation begins with hello.</p>
                  <p className="mt-2 max-w-[230px] text-xs leading-5">Your messages will show up here once you're connected.</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${message.mine ? "rounded-br-sm bg-[#D9EFAB] text-[#253126]" : "rounded-bl-sm bg-white text-[#303C31] shadow-sm"}`}>
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
              className="flex items-stretch gap-2"
            >
              <input
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                disabled={!partnerConnected}
                placeholder={partnerConnected ? "Write something nice..." : "Connect to send a message..."}
                aria-label="Chat message"
                className="min-h-12 w-full min-w-0 flex-1 rounded-xl border border-[#DFE2D9] bg-[#F7F7F2] px-4 py-3 text-base text-[#202824] outline-none placeholder:text-[#929B90] focus:border-[#6A9262] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!partnerConnected || !messageInput.trim()}
                className="min-h-12 shrink-0 rounded-xl bg-[#202824] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#3E5142] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send ↗
              </button>
            </form>
            <p className="mt-4 text-center text-xs leading-5 text-[#829083]">Enjoy the moment. Protect your privacy. Don't share personal information.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
