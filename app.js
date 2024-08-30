const express = require("express");
const fs = require("fs");
const cors = require("cors");
const { default: axios } = require("axios");
// const ffmpeg = require("ffmpeg");
// const Ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
app.use(express.json({ limit: "500mb" })); // To handle large base64 payloads
app.use(cors());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.get("/test", (req, res) => {
  return res.json({ msg: "Hi, it's working!" });
});

app.post("/media", async (req, res) => {
  const { audioUrl, videoUrl } = req.body;

  try {
    // Decode base64 to binary and save as files
    const audioFilePath = "input_audio.webm";
    const videoFilePath = "input_video.webm";
    const outputFilePath = "output.mp4";

    // Download the audio and video files temporarily
    const downloadFile = async (url, filePath) => {
      const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
      });
      return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(filePath);
        response.data.pipe(fileStream);
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
      });
    };

    // Wait for both files to download
    await Promise.all([
      downloadFile(audioUrl, audioFilePath),
      downloadFile(videoUrl, videoFilePath),
    ]);

    // Use fluent-ffmpeg to combine the files
    ffmpeg()
      .input(videoFilePath)
      .input(audioFilePath)
      .inputFormat("webm")
      .outputOptions("-c:v copy") // Copy video stream
      .outputOptions("-c:a aac") // Encode audio stream
      .on("end", () => {
        console.log("Processing finished successfully.");

        // Read the output file as base64
        const mp4Buffer = fs.readFileSync(outputFilePath);
        const mp4Base64 = mp4Buffer.toString("base64");

        // Clean up temporary files
        fs.unlinkSync(audioFilePath);
        fs.unlinkSync(videoFilePath);
        fs.unlinkSync(outputFilePath);

        // Send the base64 encoded video
        res.json({ videoBase64: `data:video/mp4;base64,${mp4Base64}` });
      })
      .on("error", (err) => {
        console.error("Error during processing:", err);
        fs.unlinkSync(audioFilePath);
        fs.unlinkSync(videoFilePath);
        res.status(500).json({ error: "Processing error" });
      })
      .save(outputFilePath); // Save output as MP4

    // try ending
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
