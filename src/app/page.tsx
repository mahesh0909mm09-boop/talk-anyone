
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
  const [messageInput, setMessageInput] = useState("");

  const chatSessionRef = useRef(0);
  const messagePendingRef = useRef(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportPending, setReportPending] = useState(false);

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

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

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
        setMessages((previous) => [
          ...previous,
          { text: message, mine: false },
        ]);
      });

      socket.on("partner-left", () => {
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
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-3 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold tracking-wide text-cyan-400 sm:text-3xl">
            TALK ANYONE
          </h1>
          <span className="rounded-full bg-slate-800 px-3 py-2 text-xs text-cyan-300 sm:px-4 sm:text-sm">
            Random Video Chat
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Meet New People Worldwide
          </h2>
          <p className="mt-2 text-slate-400">
            Talk with strangers, make friends, and have fun.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-center">
          <p className="text-cyan-300">{status}</p>
          {isSearching && (
            <p className="mt-2 text-sm text-slate-400">
              Please wait while we find someone...
            </p>
          )}
        </div>

        <div className="relative grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2">
          <div className="absolute bottom-3 right-3 z-10 w-[38%] max-w-44 overflow-hidden rounded-2xl border-2 border-cyan-400 bg-slate-900 shadow-xl md:static md:w-auto md:max-w-none md:border-slate-700 md:shadow-none">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="font-semibold">Your Camera</h3>
              <span className="text-sm text-green-400">You</span>
            </div>

            <div className="relative aspect-video bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />

              {!cameraOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400">
                  Camera is off
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="font-semibold">Stranger</h3>
              <span className="text-sm text-cyan-400">
                {partnerConnected ? "Connected" : "Not connected"}
              </span>
            </div>

            <div className="relative flex aspect-[3/4] items-center justify-center bg-black md:aspect-video">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />

              {!partnerConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <span className="text-5xl">👤</span>
                  <p className="mt-3">Waiting for a stranger</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="my-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center">
          <button
            onClick={toggleCamera}
            disabled={!localStreamRef.current}
            className="rounded-xl bg-slate-700 px-5 py-3 font-semibold transition hover:bg-slate-600 disabled:opacity-40"
          >
            {cameraOn ? "📷 Camera On" : "📷 Camera Off"}
          </button>

          <button
            onClick={toggleMic}
            disabled={!localStreamRef.current}
            className="rounded-xl bg-slate-700 px-5 py-3 font-semibold transition hover:bg-slate-600 disabled:opacity-40"
          >
            {micOn ? "🎤 Mic On" : "🔇 Mic Off"}
          </button>

          <button
            onClick={startChat}
            disabled={!!socketRef.current?.connected || isSearching || partnerConnected}
            className="rounded-xl bg-green-600 px-7 py-3 font-bold transition hover:bg-green-500 disabled:opacity-40"
          >
            Start Chat
          </button>

          <button
            onClick={nextPartner}
            disabled={!socketRef.current?.connected}
            className="rounded-xl bg-cyan-600 px-7 py-3 font-bold transition hover:bg-cyan-500 disabled:opacity-40"
          >
            Next ➜
          </button>

          <button
            onClick={blockUser}
            disabled={!partnerConnected}
            className="rounded-xl bg-orange-600 px-6 py-3 font-bold transition hover:bg-orange-500 disabled:opacity-40"
          >
            🚫 Block
          </button>
          <button
            onClick={() => setReportOpen(true)}
            disabled={!partnerConnected}
            className="rounded-xl bg-amber-600 px-6 py-3 font-bold transition hover:bg-amber-500 disabled:opacity-40"
          >
            🚩 Report
          </button>

          <button
            onClick={stopChat}
            className="rounded-xl bg-red-600 px-7 py-3 font-bold transition hover:bg-red-500"
          >
            Stop
          </button>
        </div>
        {reportOpen && partnerConnected && (
          <div className="mb-6 rounded-xl border border-amber-600 bg-slate-900 p-5">
            <h3 className="mb-3 text-lg font-bold">🚩 Report this person</h3>
            <p className="mb-3 text-sm text-slate-400">
              Choose a reason. Reporting does not automatically block someone.
            </p>
            <label htmlFor="report-reason" className="mb-2 block text-sm">Reason</label>
            <select
              id="report-reason"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 p-3"
            >
              <option value="harassment">Harassment or bullying</option>
              <option value="inappropriate-content">Inappropriate content</option>
              <option value="spam">Spam or advertising</option>
              <option value="hate-speech">Hate speech or threats</option>
              <option value="other">Other</option>
            </select>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={submitReport}
                disabled={reportPending}
                className="rounded-lg bg-amber-600 px-5 py-3 font-bold disabled:opacity-40"
              >
                {reportPending ? "Sending..." : "Submit Report"}
              </button>
              <button
                onClick={() => setReportOpen(false)}
                disabled={reportPending}
                className="rounded-lg bg-slate-700 px-5 py-3 font-bold disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={acceptedRules}
              onChange={(event) => setAcceptedRules(event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span className="text-sm text-slate-300">
              I agree to use TALK ANYONE respectfully. I will not
              share harmful, abusive, or inappropriate content.
            </span>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3 sm:p-5">
          <h3 className="mb-4 text-xl font-bold">💬 Live Chat</h3>

          <div className="mb-4 h-64 space-y-3 overflow-y-auto rounded-xl bg-slate-950 p-3 sm:h-72 sm:p-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-slate-500">
                Your messages will appear here.
              </p>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.mine ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2 ${
                    message.mine
                      ? "bg-cyan-700"
                      : "bg-slate-700"
                  }`}
                >
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
            className="flex gap-2"
          >
            <input
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              disabled={!partnerConnected}
              placeholder={
                partnerConnected
                  ? "Type your message..."
                  : "Connect with someone to chat..."
              }
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500 disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={!partnerConnected || !messageInput.trim()}
              className="rounded-xl bg-cyan-600 px-6 py-3 font-bold hover:bg-cyan-500 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>

        <div className="mt-8 text-center text-sm text-slate-500">
          Be respectful. Never share personal information with strangers.
        </div>
      </section>
    </main>
  );
}
