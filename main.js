"use strict";

let pc = null;
let videoTrack = null;
let audioTrack = null;
let pcOptions = { optional: [ {DtlsSrtpKeyAgreement: true} ] };
const pcConfig = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

let isInitiator = null;
let offer = null;
let answer = null;
let iceCandidates = [];

let remoteStream = new MediaStream();

function storeAnswerInLocalStorage()
{
    let info = location.hash.substr(2);
    localStorage["testtesttest"] = info;
}

function processAnswer(info)
{
    console.log("Processing answer");
    info = atob(info);
    info = JSON.parse(info);
    console.log(info);

    pc.setRemoteDescription(new RTCSessionDescription(info.answer)).then(function() {
        console.log("Remote description set successfully");
    }).catch(function(error) {
        console.log("Error");
        console.log(error);
    });

    for (let cand of info.candidates)
        pc.addIceCandidate(cand);
}

function onIceGatheringFinished()
{
    let info = null;
    if (isInitiator === true)
        info = { offer: offer, candidates: iceCandidates };
    else if (isInitiator === false)
        info = { answer: answer, candidates: iceCandidates };
    else
        throw "isInitiator is not set correctly";
    
    console.log("Sending offer:");
    console.log(info);

    info = JSON.stringify(info);
    info = btoa(info);
    
    let url = location.origin + location.pathname + "#";
    if (!isInitiator)
        url += "?";
    url += info;

    document.getElementById("copyurl").innerHTML = url;

    if (isInitiator)
    {
        localStorage["testtesttest"] = "";
        let timerId = setInterval(() => {
            let info = localStorage["testtesttest"];

            if (localStorage["testtesttest"].length == 0)
                return;

            clearInterval(timerId);
            processAnswer(info);
        }, 1000);
    }
}

function onIceCandidate(cand)
{
    if (cand.candidate === null)
    {
        onIceGatheringFinished();
        return;
    }
    iceCandidates.push(cand.candidate);
}

async function startSending()
{
    pc = new RTCPeerConnection(pcConfig);
    pc.addTrack(audioTrack);
    pc.addTrack(videoTrack);

    pc.ontrack = onRemoteStream;
    pc.onicecandidate = onIceCandidate;
    
    offer = await pc.createOffer();
    console.log(offer);

    await pc.setLocalDescription(offer);
}

function onRemoteStream(event)
{
    console.log("onRemoteStream");
    remoteStream.addTrack(event.track);

    let video = document.getElementById("remotevideo");
    if (video.srcObject !== remoteStream)
        video.srcObject = remoteStream;
}

async function startReceiving()
{
    let info = location.hash.substr(1);
    info = atob(info);
    info = JSON.parse(info);
    console.log(info);

    pc = new RTCPeerConnection(pcConfig);
    pc.addTrack(audioTrack);
    pc.addTrack(videoTrack);

    pc.onicecandidate = onIceCandidate;
    pc.ontrack = onRemoteStream;
    
    await pc.setRemoteDescription(new RTCSessionDescription(info.offer));
    answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    for (let cand of info.candidates)
        pc.addIceCandidate(cand);
}

export async function main()
{
    console.log("main()");
    
    if (location.hash.length > 0 && location.hash[1] == "?") // server reply
    {
        storeAnswerInLocalStorage();
        window.close(); // TODO: figure this out
        return;
    }

    try 
    {
        let stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        console.log(stream);

        videoTrack = stream.getVideoTracks()[0];
        audioTrack = stream.getAudioTracks()[0];

        var localVideo = document.getElementById("localvideo");
        localVideo.srcObject = stream;
        localVideo.muted = true;
        localVideo.play();

        // TODO: mute/unmute??
        audioTrack.enabled = false;
        videoTrack.enabled = true;
        
        // Streaming or receiving?
        if (location.hash.length > 0)
        {
            if (location.hash[1] == "?") // server reply
            {
                storeAnswerInLocalStorage();
            }
            else
            {
                isInitiator = false;
                startReceiving();
            }
        }
        else
        {
            isInitiator = true;
            startSending();
        }

    } catch(err) {
        console.log("Error:");
        console.log(err);
    }
}
