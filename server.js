const express = require("express");
const fs = require("fs");

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

// receive image
app.post("/upload", (req, res) => {
  const imageData = req.body.image.replace(/^data:image\/png;base64,/, "");
  const fileName = `photo_${Date.now()}.png`;

  fs.writeFile(fileName, imageData, "base64", (err) => {
    if (err) {
      console.log(err);
      return res.send("Error saving image");
    }

    console.log("Image saved:", fileName);
    res.send("Image received");
  });
});

app.listen(3000, () => {
  console.log("Server running → http://localhost:3000");
});
