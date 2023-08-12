'use client'

import {
  Box,
  Container,
  Button,
  Stack,
  Text,
  Input,
} from '@chakra-ui/react'
import { useState, useRef, useEffect, RefObject, createRef } from 'react';
import { useCloserStore } from '@/store/closer';
import { conferenceAPI } from '@/external/conference';

interface PeerConn {
  id: string,
  conn: RTCPeerConnection,
}
interface OfferDelay {
  id: string,
  offer: RTCSessionDescriptionInit,
}
interface AnswerDelay {
  id: string,
  answer: RTCSessionDescriptionInit,
}
interface RemoteVideo {
  id: string,
  video: RefObject<HTMLVideoElement>,
}
interface MediaStreamDelay {
  id: string,
  media: MediaStream,
}

export const VideoPlayer = () => {
  const [isPlaying, setPlaying] = useState(false);
  const [isRunning, setRunning] = useState(false);
  const [room, setRoom] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [lastMessage, setLastMessage] = useState<string[]>([]);
  const [stream, setStream] = useState<MediaStream>();
  const [wsConn, setWsConn] = useState<WebSocket>();
  const webcamVideo = useRef<HTMLVideoElement>(null);
  const remoteVideos = useRef<RemoteVideo[]>([]);
  const [peerConns, setPeerConns] = useState<PeerConn[]>([]);
  const [offerDelay, setOfferDelay] = useState<OfferDelay[]>([]);
  const [answerDelay, setAnswerDelay] = useState<AnswerDelay[]>([]);
  const [mediaStreamDelay, setMediaStreamDelay] = useState<MediaStreamDelay[]>([]);

  const setNewCloser = useCloserStore((state) => state.setCloser)

  const startStream = async () => {
      await navigator.mediaDevices
        .getUserMedia({
          video: true,
          audio: false,
        })
        .then((newStream) => {
          if (webcamVideo.current != undefined) {
            webcamVideo.current.srcObject = newStream;
          }
          setStream(newStream);
          setRoom(roomInput);
          setPlaying(true);
        });
  };

  const stopStream = () => {
    if (stream != undefined) {
      stream.getTracks().forEach((track) => track.stop());
    }

    setPlaying(false);
  };

  const stopSubscribe = () => {
    wsConn?.close()
  }

  useEffect(() => {
    if (isRunning && !isPlaying) {
      startStream();
    }
    if (!isRunning && isPlaying) {
      stopStream();
    }
  }, [isRunning, isPlaying])

  useEffect(() => {
    const startSubscribe = (roomID: string) => {
      try {
        const ws = new WebSocket(conferenceAPI);
        setWsConn(ws);
  
        ws.onmessage = (event) => {
          // console.log(event.data)
          setLastMessage(prev => [...prev, event.data]);
        }
  
        ws.onopen = (event) => {
          ws.send(JSON.stringify({
            "msg_type": "joinRoom",
            "room_id": roomID,
          }))
        }
  
      } catch (error) {
        console.log(error);
      }
    }

    if (room !== "") {
      startSubscribe(room);
    }
  }, [room])

  useEffect(() => {
    const createOffer = async (id: string) => {
      const peer = new RTCPeerConnection({'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]});
      if (stream != undefined) {
        stream.getTracks().forEach((track) => {
          // sender
          peer.addTrack(track, stream);
        });
      }
      peer.addEventListener("track", async (event) => {
        console.log("ontrack");
        const [remoteStream] = event.streams;
        let videoElement = createRef<HTMLVideoElement>();
        const idx = remoteVideos.current.push({
          id: id,
          video: videoElement,
        });
        setMediaStreamDelay(prev => [...prev, {
          id: id,
          media: remoteStream,
        }])
      })
      peer.addEventListener("icecandidate", (event) => {
        console.log("icecandidate", event);
        if (event.candidate !== null) {
          wsConn?.send(JSON.stringify({
            "msg_type": "addIceCandidate",
            "candidate": event.candidate?.candidate,
            "sdp_mline_index": event.candidate?.sdpMLineIndex,
            "sdp_mid": event.candidate?.sdpMid,
            "username_fragment": event.candidate?.usernameFragment,
            "id": id,
          }));
        }
      });
  
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
  
      setPeerConns(prev => [...prev, {id: id, conn: peer}]);
      setOfferDelay(prev => [...prev, {id: id, offer: offer}]);

      console.log("createOffer", offer);
  
      return offer
    }
  
    const createAnswer = async (id:string, sdp: string) => {
      const peer = new RTCPeerConnection({'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]});
      if (stream != undefined) {
        stream.getTracks().forEach((track) => {
          // sender
          peer.addTrack(track, stream);
        });
      }
      peer.addEventListener("icecandidate", (event) => {
        console.log("icecandidate", event);
        if (event.candidate !== null) {
          wsConn?.send(JSON.stringify({
            "msg_type": "addIceCandidate",
            "candidate": event.candidate?.candidate,
            "sdp_mline_index": event.candidate?.sdpMLineIndex,
            "sdp_mid": event.candidate?.sdpMid,
            "username_fragment": event.candidate?.usernameFragment,
            "id": id,
          }));
        }
      });
      peer.addEventListener("track", async (event) => {
        console.log("ontrack");
        const [remoteStream] = event.streams;
        let videoElement = createRef<HTMLVideoElement>();
        const idx = remoteVideos.current.push({
          id: id,
          video: videoElement,
        });
        setMediaStreamDelay(prev => [...prev, {
          id: id,
          media: remoteStream,
        }])
      })
  
      const remoteDesc = new RTCSessionDescription({sdp: sdp, type: "offer"});
      await peer.setRemoteDescription(remoteDesc);
      const answer = await peer.createAnswer();
  
      setPeerConns(prev => [...prev, {id: id, conn: peer}]);
      setAnswerDelay(prev => [...prev, {id: id, answer: answer}]);

      console.log("createAnswer", answer);
  
      return answer
    }
  
    const acceptAnswer = async (id:string, sdp: string) => {
      const peer = peerConns.filter(val => val.id === id)[0].conn;
      const offer = offerDelay.filter(val => val.id === id)[0].offer;

      const remoteDesc = new RTCSessionDescription({sdp: sdp, type: "answer"});
      await peer.setLocalDescription(offer);
      await peer.setRemoteDescription(remoteDesc);
    }

    const ackAcceptAnswer = async (id:string) => {
      const peer = peerConns.filter(val => val.id === id)[0].conn;
      const answer = answerDelay.filter(val => val.id === id)[0].answer;
      await peer.setLocalDescription(answer);
    }

    const addIceCandidate = async (id:string, candidate: string, sdpMLineIndex: number, sdpMid: string, usernameFragment: string) => {
      const peer = peerConns.filter(val => val.id === id)[0].conn;
  
      await peer.addIceCandidate({
        candidate: candidate,
        sdpMLineIndex: sdpMLineIndex,
        sdpMid: sdpMid,
        usernameFragment: usernameFragment,
      });
    }
  
    const removePeer = async (id:string) => {
      const peer = peerConns.filter(val => val.id === id)[0].conn;
      // peer.removeTrack(sender)
      peer.close();
      // remoteVideos.current = remoteVideos.current.filter(value => value.current)
      setPeerConns(prev => prev.filter(value => value.id !== id));
    }

    if (lastMessage.length === 0) {
      return
    }

    const data = JSON.parse(lastMessage.at(0)!!);
          
    const id = data.id;
    if (data.msg_type === "createOffer") {
      createOffer(id).then((offer) => {
        wsConn?.send(JSON.stringify({
          "msg_type": data.msg_type,
          "sdp": offer.sdp,
          "id": id,
        }))
      });
    } else if (data.msg_type === "createAnswer") {
      createAnswer(id, data.sdp).then((answer) => {
        wsConn?.send(JSON.stringify({
          "msg_type": data.msg_type,
          "sdp": answer.sdp,
          "id": id,
        }))
      });
    } else if (data.msg_type === "acceptAnswer") {
      acceptAnswer(id, data.sdp).then(() => {
        wsConn?.send(JSON.stringify({
          "msg_type": data.msg_type,
          "id": id,
        }))
      });
    } else if (data.msg_type === "ackAcceptAnswer") {
      ackAcceptAnswer(id);
    } else if (data.msg_type === "addIceCandidate") {
      addIceCandidate(id, data.candidate, data.sdp_mline_index, data.sdp_mid, data.username_fragment);
    } else if (data.msg_type === "removePeer") {
      // await removePeer(id);
    }

    setLastMessage(prev => prev.filter((val, idx, _) => idx != 0));
  }, [lastMessage])

  useEffect(() => {
    const idx = mediaStreamDelay.length-1
    if (idx < 0) {
      return
    }
    const mediaStream = mediaStreamDelay[idx];
    const videoElement = remoteVideos.current[idx]
    if (videoElement.video.current != null) {
      videoElement.video.current.srcObject = mediaStream.media;
      videoElement.video.current.muted = true;
      videoElement.video.current.play();
    }
  }, [mediaStreamDelay]);
 
  useEffect(() => {
    setNewCloser(() => {
      setRunning(false);
    });
  }, [])
 
  return (
    <>
      <Container maxW={'3xl'}>
        <Stack
          as={Box}
          textAlign={'center'}
          spacing={{ base: 8, md: 14 }}
          py={{ base: 20, md: 36 }}>
          { isRunning ? <>
            <Text>Webcam</Text>
            <video ref={webcamVideo} autoPlay playsInline></video>
          </> : <>
          <Input
            value={roomInput}
            onChange={(event) => setRoomInput(event.target.value)}
            placeholder='Put your room id here'
            size='sm'
          />
          </> }
          {
            isRunning ? <></> : <Button onClick={() => {
            setRunning(!isRunning);
          }}>
              <Text>Start</Text>
            </Button>
          }
          { remoteVideos.current.length > 0 ? <Text>Others</Text> : <></>}
          { remoteVideos.current.map(remoteVideo => {
            return <video key={remoteVideo.id} ref={remoteVideo.video} autoPlay playsInline></video>
          }) }
        </Stack>
      </Container>
    </>
  )
}