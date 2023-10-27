<template>
  <div id="webcam-page">
    <div id="webcam-container" ref="webcamContainer">
      <video
        id="video"
        ref="video"
        autoplay
        muted
        playsinline
        @loadeddata="loadData"
      ></video>
      <canvas id="canvas"></canvas>
    </div>
  </div>
</template>

<script>
import "@mediapipe/face_detection";
import "@tensorflow/tfjs-core"; // Register WebGL backend.
import "@tensorflow/tfjs-backend-webgl";
import { MediaStreamRecorder, RecordRTCPromisesHandler } from "recordrtc";
import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import * as blink from "@/utilities/blink-prediction";

export default {
  name: "App",
  data() {
    return {
      faceDetector: null,
      isBlink: false,
      steam: null,
      mediaRecorder: null,
      recordedChunks: [],
      downloading: false,
    };
  },
  methods: {
    async setupVideo() {
      const video = document.getElementById("video");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: {
            ideal: 1920,
          },
          height: {
            ideal: 1080,
          },
          facingMode: "user",
          aspectRatio: 16 / 9,
          frameRate: {
            ideal: 30,
          },
        },
        audio: false,
      });

      this.stream = stream;
      video.srcObject = stream;
      video.src = stream;
    },
    async setupCanvas() {
      const canvas = document.getElementById("canvas");
      canvas.width = document.getElementById("webcam-page").offsetWidth;
      canvas.height = document.getElementById("webcam-page").offsetHeight;
    },
    async setupFaceRecognitionModel() {
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detectorConfig = {
        runtime: "mediapipe", // or 'tfjs'
        solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh",
      };
      this.faceDetector = await faceLandmarksDetection.createDetector(
        model,
        detectorConfig
      );
    },
    async setupMediaRecorder() {
      const video = document.getElementById("video");
      const options = {
        type: "video",
        recorderType: MediaStreamRecorder,
        timeSlice: 1000,
        mimeType: "video/mp4;codecs=h264",
        videoBitsPerSecond: 8000000,
        quality: 100,
        video,
      };

      // MediaRecorder initialize with video/mp4 format
      this.mediaRecorder = new RecordRTCPromisesHandler(this.stream, options);
    },
    async download() {
      /**
       This code is converting `chunks` that we get from mediaRecorder / recordrtc.
       And convert it to Blob, so we able to convert the blob to file and upload using multipart to our golang api.
       */
      Toastify({
        text: "Processing video!",
        duration: -1,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "center", // `left`, `center` or `right`
        stopOnFocus: true, // Prevents dismissing of toast on hover
        style: {
          background: "red",
        },
      }).showToast();
      const blob = await this.mediaRecorder.getBlob();
      const video = URL.createObjectURL(blob);
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.style = "display: none";
      a.href = video;
      a.download = `test-${new Date().getTime()}.mp4`;
      a.click();
      window.URL.revokeObjectURL(video);
      Toastify({
        text: "Downloaded",
        duration: -1,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "center", // `left`, `center` or `right`
        stopOnFocus: true, // Prevents dismissing of toast on hover
        style: {
          background: "green",
        },
      }).showToast();
    },
    async predictingFaceBound() {
      const video = document.getElementById("video");
      const faces = await this.faceDetector.estimateFaces(video);
      const canvas = document.getElementById("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, video.videoWidth, video.videoHeight);

      faces.forEach(async (face) => {
        const { box, keypoints } = face;

        const faceDimension = this.getFaceDimensions(box);
        const faceCenter = this.getFaceCenter(faceDimension, box);
        const screen = !this.screenPercentage(faceDimension, box);
        const matchCriteria = faceCenter && screen;

        if (!this.isBlink && matchCriteria) {
          const result = await blink.startPrediciton(video, keypoints);
          this.isBlink = result;

          if (result) {
            Toastify({
              text: "Blinking detected!",
              duration: 3000,
              close: true,
              gravity: "bottom", // `top` or `bottom`
              position: "center", // `left`, `center` or `right`
            }).showToast();
            setTimeout(async () => {
              await this.mediaRecorder.stopRecording();
              await this.download();
            }, 1000);
          }
        }

        ctx.beginPath();
        ctx.lineWidth = "4";
        ctx.strokeStyle = matchCriteria ? "green" : "red";
        ctx.rect(box.xMin, box.yMin, box.width, box.height);
        ctx.stroke();
      });

      window.requestAnimationFrame(this.predictingFaceBound);
    },
    getFaceDimensions(box) {
      return {
        left: box.xMin,
        top: box.yMin,
        right: box.xMax,
        bottom: box.yMax,
      };
    },
    getFaceCenter(faceDimensions, box) {
      const { xMax, xMin, yMax, yMin } = box;
      const faceCenterX = (xMax + xMin) / 2;
      const faceCenterY = (yMax + yMin) / 2;
      const videoCenterX = 540;
      const videoCenterY = 960;
      const tolerance = 100;

      return (
        Math.abs(faceCenterX - videoCenterX) <= tolerance &&
        Math.abs(faceCenterY - videoCenterY) <= tolerance
      );
    },

    screenPercentage(faceDimensions, box) {
      const video = document.getElementById("video");
      const width = video.videoWidth;
      const height = video.videoHeight;

      return (
        faceDimensions.bottom - faceDimensions.top <= width * 0.3 ||
        faceDimensions.right - faceDimensions.left <= height * 0.3
      );
    },

    loadData() {
      window.requestAnimationFrame(this.predictingFaceBound);
      this.mediaRecorder.startRecording();
    },
  },
  async mounted() {
    await this.setupFaceRecognitionModel();
    await this.setupVideo();
    await this.setupCanvas();
    await this.setupMediaRecorder();
  },
};
</script>

<style>
#webcam-page {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
}

#webcam-container {
  height: 100%;
}

#video {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

#canvas {
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
}
</style>
