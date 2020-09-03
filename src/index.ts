import Twitter from "twitter";
import RobotJS from "robotjs";
import fs from "fs";
require("dotenv").config();

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

const screenshotsPath = "C:\\Screenshots\\";

type Action =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT"
  | "A"
  | "B"
  | "L"
  | "R"
  | "START"
  | "SELECT"
  | "PRINT"
  | "PAUSE"
  | "SAVE_STATE";

const PLAYER_ACTIONS: Action[] = [
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

type Tweet = {
  id: string;
  text: string;
  username: string;
  link: string;
  inReplyToStatusId: string | null;
  action: Action | null;
};

mainLoop();
async function mainLoop() {
  let lastTweet: Tweet | null = null;
  console.log("Waiting for start...");
  await sleep(5 * 1000);
  console.log("Started!");

  while (true) {
    var lastTweetId = lastTweet?.id ?? process.env.LAST_TWEET_ID;

    console.log("Receiving order...");
    const order = await findNextTweetCommand(lastTweetId);
    console.log("Order received!", order);

    console.log("Applying action...");
    await applyAction(order.action);

    console.log("Tweeting...");
    lastTweet = await tweet(order, lastTweetId);
    console.log("Tweeted!");

    await sleep(5 * 60 * 1000);
  }
}

function getPathToImage() {
  const imageFiles = fs.readdirSync(screenshotsPath);
  if (imageFiles.length !== 1) {
    throw new Error(`${imageFiles.length} image files on ${screenshotsPath}`);
  }

  return `${screenshotsPath}${imageFiles}`;
}

async function tweet(order: Tweet, lastTweetId: string) {
  const pathToImage = getPathToImage();
  var data = fs.readFileSync(pathToImage);
  try {
    const media = await client.post("media/upload", {
      media: data,
    });

    var status = {
      in_reply_to_status_id: lastTweetId,
      username: "TweetsPlaysPkmn",
      media_ids: media.media_id_string,
      status: `Button ${order.action} pressed by @${order.username}!
[by tweeting a message with the word "${order.action}"]

What should we do next?
[Reply with a button to be pressed]

#Pokemon #PokemonMastersEX
${order.link}`,
    };

    const tweet = await client.post("statuses/update", status);
    const normalizedTweet = normalizeTweet(tweet);
    fs.unlinkSync(pathToImage);

    return normalizedTweet;
  } catch (error) {
    throw new Error(`Error on tweet: ${error}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyAction(action: Action) {
  pressAction("PAUSE");
  pressAction(action);
  await sleep(5000);

  pressAction("PRINT");
  pressAction("SAVE_STATE");
  pressAction("PAUSE");
  await sleep(1000);
}

function pressAction(action: Action) {
  RobotJS.keyTap(actionToButton[action]);
}

const actionToButton: { [key in Action]: string } = {
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
  A: "numpad_1",
  B: "numpad_2",
  L: "numpad_4",
  R: "numpad_5",
  START: "numpad_3",
  SELECT: "numpad_6",
  PRINT: "numpad_7",
  PAUSE: "numpad_8",
  SAVE_STATE: "numpad_9",
};

async function findNextTweetCommand(lastTweetId: string): Promise<Tweet> {
  const mentions = await getRepliesToTweet(lastTweetId);
  const mentionsWithActions = mentions.filter((tweet) => tweet.action !== null);
  if (mentionsWithActions.length > 0) {
    return getRandomItemFromArray(mentionsWithActions);
  }

  return await getRandomCommandTweet();
}
function getRandomItemFromArray(array: Array<any>): any {
  return array[Math.floor(Math.random() * array.length)];
}

async function getRepliesToTweet(tweetId: string): Promise<Tweet[]> {
  const mentions = await getMentions();
  return mentions.filter((tweet) => tweet.inReplyToStatusId === tweetId);
}

async function getMentions(): Promise<Tweet[]> {
  const tweets = await client.get("statuses/mentions_timeline", {
    tweet_mode: "extended",
  });
  return tweets.map((tweet) => normalizeTweet(tweet));
}

function normalizeTweet(raw: any): Tweet {
  const id = raw.id_str;
  const username = raw.user.screen_name;
  const link = `https://twitter.com/${username}/status/${id}`;
  const inReplyToStatusId = raw.in_reply_to_status_id_str;
  const text = raw.full_text ?? raw.text;
  const action = findActionFromText(text);

  return {
    id,
    username,
    link,
    inReplyToStatusId,
    text,
    action,
  };
}

function findActionFromText(text: string) {
  const words = text.toLowerCase().split(" ");
  const action = PLAYER_ACTIONS.find((action) =>
    words.find((word) => word === action.toLowerCase())
  );
  return action ?? null;
}

async function getRandomCommandTweet(): Promise<Tweet> {
  const response = await client.get("search/tweets", {
    q: "Pokemon " + getRandomItemFromArray(PLAYER_ACTIONS),
    since_id: 54321,
    tweet_mode: "extended",
    result_type: "recent",
    count: 50,
    include_entities: true,
  });

  const tweetsWithActions: Tweet[] = response.statuses
    .map((tweet) => normalizeTweet(tweet))
    .filter((tweet) => tweet.action !== null);

  return getRandomItemFromArray(tweetsWithActions);
}
