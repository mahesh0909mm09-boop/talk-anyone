
"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type Message = {
  text: string;
  mine: boolean;
};

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

      const socket = io("https://talk-anyone-5mlu.onrender.com");
      socketRef.current = socket;

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
        setMessages([]);
        setPartnerConnected(true);
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

    if (!text || !partnerConnected) return;

    socketRef.current?.emit("chat-message", text);

    setMessages((previous) => [
      ...previous,
      { text, mine: true },
    ]);

    setMessageInput("");
  }

  function nextPartner() {
    if (!socketRef.current?.connected) {
      setStatus("Press Start to begin chatting.");
      return;
    }

    closePeer();
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

  function blockUser() {
    if (!partnerConnected) return;

    const confirmed = window.confirm(
      "Are you sure you want to block this person?"
    );

    if (!confirmed) return;

    closePeer();
    setPartnerConnected(false);
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
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-3xl font-extrabold tracking-wide text-cyan-400">
            TALK ANYONE
          </h1>
          <span className="rounded-full bg-slate-800 px-4 py-2 text-sm text-cyan-300">
            Random Video Chat
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold">
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

        <div className="grid gap-5 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
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

            <div className="relative flex aspect-video items-center justify-center bg-black">
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

        <div className="my-6 flex flex-wrap justify-center gap-3">
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
            onClick={stopChat}
            className="rounded-xl bg-red-600 px-7 py-3 font-bold transition hover:bg-red-500"
          >
            Stop
          </button>
        </div>
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

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h3 className="mb-4 text-xl font-bold">💬 Live Chat</h3>

          <div className="mb-4 h-56 space-y-3 overflow-y-auto rounded-xl bg-slate-950 p-4">
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
