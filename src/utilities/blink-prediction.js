/* eslint-disable camelcase */
// import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
// import "@tensorflow/tfjs-backend-webgl";

const EAR_THRESHOLD_HIGH = 0.4;
const EAR_THRESHOLD_LOW = 0.25;
const SUCC_FRAME = 2;
let countFrame = 0;
let detector;
let result = false;

const calculateEar = (keypoints, eye) => {
  const eye0 = keypoints[eye[0]];
  const eye1 = keypoints[eye[1]];
  const eye2 = keypoints[eye[2]];
  const eye3 = keypoints[eye[3]];
  const eye4 = keypoints[eye[4]];
  const eye5 = keypoints[eye[5]];

  const x1 = Math.abs(eye1.x - eye3.x);
  const y1 = Math.abs(eye1.y - eye3.y);
  const y1_s = Math.sqrt(x1 ** 2 + y1 ** 2);

  const x2 = Math.abs(eye2.x - eye4.x);
  const y2 = Math.abs(eye2.y - eye4.y);
  const y2_s = Math.sqrt(x2 ** 2 + y2 ** 2);

  const x3 = Math.abs(eye0.x - eye5.x);
  const y3 = Math.abs(eye0.y - eye5.y);
  const y3_s = Math.sqrt(x3 ** 2 + y3 ** 2);

  return (y1_s + y2_s) / y3_s;
};

const startPrediciton = async (video, keypoints) => {
  // Sending video to model for prediction
  const rightEye = [33, 160, 158, 144, 153, 133];
  const leftEye = [263, 387, 385, 373, 380, 362];

  const leftEar = calculateEar(keypoints, leftEye);
  const rightEar = calculateEar(keypoints, rightEye);

  const avgEar = (leftEar + rightEar) / 2;

  if (avgEar >= EAR_THRESHOLD_LOW && avgEar < EAR_THRESHOLD_HIGH) {
    countFrame += 1;
  } else {
    if (countFrame >= SUCC_FRAME) {
      result = true;
    } else {
      result = false;
      countFrame = 0;
    }
  }

  return result;
};

export { startPrediciton };
