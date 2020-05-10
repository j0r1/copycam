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
let lzma = new LZMA("lzma_worker.js");

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

async function processAnswer_helper(info)
{
    try
    {
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
        log("Error processing answer (helper): " + err);
    }
}

function processAnswer(info)
{
    try
    {
        console.log("Processing answer");
        info = FromBase64(info);
        info = new Int8Array(info);
        lzma.decompress(info, (result, err) => {
            if (err)
            {
                log("Error decompressing result: " + err);
                return;
            }
            processAnswer_helper(result);
        });
    }
    catch(err)
    {
        log("Error processing answer: " + err);
    }
}

function ToBase64(u8) {
    return btoa(String.fromCharCode.apply(null, u8));
}

function FromBase64(str) {
    return atob(str).split('').map(function (c) { return c.charCodeAt(0); });
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

    info = JSON.stringify(info);

    log("Compressing JSON object of length " + info.length);
    lzma.compress(info, 9, (result, err) => {
        if (err)
        {
            log("Error in compression: " + err);
            return;
        }

        log("Compression finished, length is " + result.length);
        try {

            let info = ToBase64(new Uint8Array(result));
            log("B64 length is " + info.length);

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

    });


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

async function startReceiving_helper(info)
{
    try
    {
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
        log("Error in startReceiving_helper: " + err);
    }
}

async function startReceiving()
{
    try
    {
        let info = location.hash.substr(1);
        info = FromBase64(info);
        info = new Int8Array(info);
        lzma.decompress(new Int8Array(info), (result, err) => {
            if (err)
            {
                log("Unable to decompress offer " + err);
                return; 
            }

            startReceiving_helper(result);
        });
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
