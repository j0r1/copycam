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
let dialog = null;

const responseUrl = "response.html";

function log0(msg, canClose = false)
{
    if (dialog)
    {
        dialog.close();
        dialog = null;
    }
    
    let opts = {
        message: "Status: " + msg,
        escapeButtonCloses: false,
        overlayClosesOnClick: false,
        showCloseButton: false,
    }
    if (!canClose)
        opts.buttons = [];

    dialog = vex.dialog.alert(opts);
}

function log(msg)
{
    let elem = document.getElementById("logdiv");
    elem.innerText += "" + msg + "\n";
}

function storeAnswerInLocalStorage()
{
    let info = location.hash.substr(2);
    localStorage["testtesttest"] = info;
    log("Response recorded, switch back to other tab")
}

function processAnswer(info)
{
    try
    {
        console.log("Processing answer");
        info = atob(info);
        log(info);
        info = JSON.parse(info);
        console.log(info);

        pc.setRemoteDescription(new RTCSessionDescription(info.answer)).then(function() {
            console.log("Remote description set successfully");
            log("Remote description configured")
            if (dialog)
                dialog.close();
        }).catch(function(error) {
            console.log("Error");
            console.log(error);
            log("Error setting remote description:" + error);
        });

        for (let cand of info.candidates)
            pc.addIceCandidate(cand);
    }
    catch(err)
    {
        log("Error processing answer: " + err);
    }
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
    
    log("Ice gathering finished");

    console.log("Sending offer:");
    console.log(info);

    try {

        info = JSON.stringify(info, null, 2);
        info = btoa(info);
        
        let url = location.origin + location.pathname;
        if (!isInitiator)
            url += responseUrl + "#?";
        else
            url += "#";

        url += info;

        navigator.clipboard.writeText(url);

        if (isInitiator)
        {
            localStorage["testtesttest"] = "";
            let timerId = setInterval(() => {
                let info = localStorage["testtesttest"];

                if (localStorage["testtesttest"].length == 0)
                {
                    log("No response found");
                    return;
                }

                log("Found response");
                clearInterval(timerId);
                processAnswer(info);
            }, 2000);
            log("Connection information gathered, copy clipboard url to other participant. Waiting for response...")
        }
        else
            log("Connection information gathered, copy clipboard url to other participant and close dialog", true)
    }
    catch(err)
    {
        log("Error: " + err);
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
    log("Got " + iceCandidates.length + " candidates");
}

async function startSending()
{
    try
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
    catch(err)
    {
        log("Error in startSending: " + err);
    }
}

function onRemoteStream(event)
{
    console.log("onRemoteStream");
    remoteStream.addTrack(event.track);
}

async function startReceiving()
{
    try
    {
        let info = location.hash.substr(1);
        info = atob(info);
        log(info);
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
    catch(err)
    {
        log("Error in startReceiving: " + err);
    }
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

    let video = document.getElementById("remotevideo");
    video.srcObject = remoteStream;

    try 
    {
        log("Getting camera input");
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
        log("Gathering connection information")

    } catch(err) {
        console.log("Error:");
        console.log(err);
        log("Error: " + err);
    }
}
