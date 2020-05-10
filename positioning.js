function setSize(videoElem, maxW, maxH)
{
    if (videoElem.videoWidth == 0 || videoElem.videoHeight == 0)
        return;

    let aspect = videoElem.videoWidth/videoElem.videoHeight;
    let w = maxW;
    let h = Math.round(w/aspect);

    if (h > maxH)
    {
        h = maxH;
        w = Math.round(h*aspect);
    }

    videoElem.style.width = "" + w + "px";
    videoElem.style.height = "" + h + "px";
}

function onResize()
{
    let h = innerHeight;
    let w = innerWidth;
    console.log("Resizing to " + w + "x" + h);

    let factor = 4;
    setSize(document.getElementById("localvideo"), Math.round(w/factor), Math.round(h/factor));
    setSize(document.getElementById("remotevideo"), Math.round(w), Math.round(h));
}

window.onresize = onResize;
document.getElementById("localvideo").onresize = onResize;
document.getElementById("remotevideo").onresize = onResize;
//setInterval(onResize, 1000);
