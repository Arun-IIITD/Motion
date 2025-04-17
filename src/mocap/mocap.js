const { globalSettings } = require("../utils/setting.js");


var ipcRenderer = require("electron").ipcRenderer;
var started = false;

var modelObj = JSON.parse(localStorage.getItem("modelInfo"));
var modelPath = modelObj.path;

var fileType = modelPath
    .substring(modelPath.lastIndexOf(".") + 1)
    .toLowerCase();


if (globalSettings.forward.enableForwarding)
    ipcRenderer.send(
        "startWebServer",
        parseInt(globalSettings.forward.port),
        JSON.stringify(modelObj),
        globalSettings.forward.supportForWebXR
    );


const animateVRM = (vrm, results) => {
    let riggedPose, riggedLeftHand, riggedRightHand, riggedFace;

    const faceLandmarks = results.faceLandmarks;
    const pose3DLandmarks = results.za;
    const pose2DLandmarks = results.poseLandmarks;
    const leftHandLandmarks = results.rightHandLandmarks;
    const rightHandLandmarks = results.leftHandLandmarks;

    if (faceLandmarks) {
        riggedFace = Kalidokit.Face.solve(faceLandmarks, {
            runtime: "mediapipe",
            video: videoElement,
        });
    }

    if (pose2DLandmarks && pose3DLandmarks) {
        riggedPose = Kalidokit.Pose.solve(pose3DLandmarks, pose2DLandmarks, {
            runtime: "mediapipe",
            video: videoElement,
        });
    }

    if (leftHandLandmarks) {
        riggedLeftHand = Kalidokit.Hand.solve(leftHandLandmarks, "Left");
    }

    if (rightHandLandmarks && fileType == "vrm") {
        riggedRightHand = Kalidokit.Hand.solve(rightHandLandmarks, "Right");
    }

    if (globalSettings.forward.enableForwarding)
        ipcRenderer.send(
            "sendBoradcastNew",
            {
                type: "xf-sysmocap-data",
                riggedPose: riggedPose,
                riggedLeftHand: riggedLeftHand,
                riggedRightHand: riggedRightHand,
                riggedFace: riggedFace,
            }
        );
        else ipcRenderer.send(
            "sendRenderData",
            {
                type: "xf-sysmocap-data",
                riggedPose: riggedPose,
                riggedLeftHand: riggedLeftHand,
                riggedRightHand: riggedRightHand,
                riggedFace: riggedFace,
            }
        );
};

let videoElement = document.querySelector(".input_video"), guideCanvas = document.querySelector("canvas.guides");

const onResults = (results) => {
    if (globalSettings.preview.showSketelonOnInput) 
        drawResults(results);
    
    animateVRM(null, results);
    
    if (!started) {
        if (localStorage.getItem("useCamera") == "file") 
            videoElement.play();
        
            started = true;
    }
};

const holistic = new Holistic({
    locateFile: (file) => {
        if (typeof require != "undefined")
            return __dirname + `/../node_modules/@mediapipe/holistic/${file}`;
        else 
            return `../node_modules/@mediapipe/holistic/${file}`;
    },
});

holistic.setOptions({
    modelComplexity: parseInt(globalSettings.mediapipe.modelComplexity),
    smoothLandmarks: globalSettings.mediapipe.smoothLandmarks,
    minDetectionConfidence: parseFloat(
        globalSettings.mediapipe.minDetectionConfidence
    ),
    minTrackingConfidence: parseFloat(
        globalSettings.mediapipe.minTrackingConfidence
    ),
    refineFaceLandmarks: globalSettings.mediapipe.refineFaceLandmarks,
});

holistic.onResults(onResults);

const drawResults = (results) => {
    guideCanvas.width = videoElement.videoWidth;
    guideCanvas.height = videoElement.videoHeight;
    let canvasCtx = guideCanvas.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, guideCanvas.width, guideCanvas.height);
    
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: "#00cff7",
        lineWidth: 4,
    });
    drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: "#ff0364",
        lineWidth: 2,
    });
    drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, {
        color: "#C0C0C070",
        lineWidth: 1,
    });
    if (results.faceLandmarks && results.faceLandmarks.length === 478) {
        drawLandmarks(
            canvasCtx,
            [results.faceLandmarks[468], results.faceLandmarks[468 + 5]],
            {
                color: "#ffe603",
                lineWidth: 2,
            }
        );
    }
    drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {
        color: "#eb1064",
        lineWidth: 5,
    });
    drawLandmarks(canvasCtx, results.leftHandLandmarks, {
        color: "#00cff7",
        lineWidth: 2,
    });
    drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {
        color: "#22c3e3",
        lineWidth: 5,
    });
    drawLandmarks(canvasCtx, results.rightHandLandmarks, {
        color: "#ff0364",
        lineWidth: 2,
    });
};


if (localStorage.getItem("useCamera") == "camera") {
    navigator.mediaDevices
        .getUserMedia({ video: { deviceId: localStorage.getItem("cameraId"),width: 1280, height: 720 } })
        .then(function (stream) {
            videoElement.srcObject = stream;
            videoElement.play();
            var videoFrameCallback = async () => {
                await holistic.send({ image: videoElement });
                videoElement.requestVideoFrameCallback(videoFrameCallback);
            };

            videoElement.requestVideoFrameCallback(videoFrameCallback);
        })
        .catch(function (err0r) {
            alert(err0r);
        });
} else {
    videoElement.src = localStorage.getItem("videoFile");
    videoElement.loop = true;
    videoElement.controls = true;

    videoElement.style.transform = "";
    guideCanvas.style.transform = "";

    var videoFrameCallback = async () => {
        await holistic.send({ image: videoElement });
        videoElement.requestVideoFrameCallback(videoFrameCallback);
    };

    videoElement.requestVideoFrameCallback(videoFrameCallback);
}