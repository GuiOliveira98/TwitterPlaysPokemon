import GameBoyAdvance from "gbajs";
import fs from "fs";
import express from "express";
import bodyParser from "body-parser";

var gba = new GameBoyAdvance();
gba.logLevel = gba.LOG_ERROR;

var biosBuf = fs.readFileSync("./node_modules/gbajs/resources/bios.bin");
gba.setBios(biosBuf);
gba.setCanvasMemory();

gba.loadRomFromFile("rom/PokemonLeafGreen.gba", function (err, result) {
  if (err) {
    console.error("loadRom failed:", err);
    process.exit(1);
  }
  gba.runStable();
});

const PLAYER_ACTIONS = [
  "START",
  "SELECT",
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "A",
  "B",
  "L",
  "R",
];

const app = express();
app.use(bodyParser.json());
app.listen(3535);

app.get("/execute", function (req, res) {
  console.log(`Get /execute with body: `, req.body);
  const message = req.body.command.toUpperCase();

  if (PLAYER_ACTIONS.find((action) => action === message)) {
    var keypad = gba.keypad;
    keypad.press(keypad[message]);
  }

  if (message === "SCREENSHOT") {
    var png = gba.screenshot();
    png.pack().pipe(fs.createWriteStream("screenshot/image.png"));
  }

  if (message === "LOAD_SAVE") {
    gba.loadSavedataFromFile("save/game.sav");
  }

  if (message === "DOWNLOAD_SAVE") {
    gba.downloadSavedataToFile("save/game.sav");
  }

  res.send("Completed!");
});
