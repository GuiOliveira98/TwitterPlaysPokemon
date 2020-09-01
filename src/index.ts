import Twitter from "twitter";
import RobotJS from "robotjs";
require("dotenv").config();

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

var data = require("fs").readFileSync(
  "C:\\Users\\Guilherme Oliveira\\Downloads\\Pokemon - LeafGreen Version (USA, Europe) (Rev 1)\\image.png"
);

//const commandTweet = await findNextTweetCommand()
//executeCommand(commandTweet.command)
//waitForAction()
//printGame()
//pause()
//saveState()
//tweetPrintScreen(commandTweet.username, commandTweet.link)
//waitTweetCooldown()

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
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "A",
  "B",
  "L",
  "R",
  "START",
  "SELECT",
];

type Tweet = {
  id: string;
  text: string;
  username: string;
  link: string;
  inReplyToStatusId: string | null;
  action: Action | null;
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
async function main() {
  await sleep(2000);
  while (true) {
    await applyAction("A");
  }
}

async function applyAction(action: Action) {
  pressAction("PAUSE");
  pressAction(action);
  await sleep(5000);
  pressAction("PRINT");
  pressAction("SAVE_STATE");
  pressAction("PAUSE");
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

async function findNextTweetCommand(): Promise<Tweet> {
  const mentions = await getRepliesToTweet(process.env.LAST_TWEET_ID);
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
    q: getRandomItemFromArray(PLAYER_ACTIONS),
    since_id: 54321,
    tweet_mode: "extended",
    result_type: "popular",
    count: 50,
    include_entities: true,
  });

  const tweetsWithActions: Tweet[] = response.statuses
    .map((tweet) => normalizeTweet(tweet))
    .filter((tweet) => tweet.action !== null);

  return getRandomItemFromArray(tweetsWithActions);
}
