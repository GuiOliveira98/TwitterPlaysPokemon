import Twitter from "twitter";
import { type } from "os";
import { generateKeyPairSync } from "crypto";
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
  | "SELECT";

const ACTIONS: Action[] = [
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

findNextTweetCommand().then((tweet) => console.log(tweet));

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
  const action = ACTIONS.find((action) =>
    words.find((word) => word === action.toLowerCase())
  );
  return action ?? null;
}

async function getRandomCommandTweet(): Promise<Tweet> {
  const response = await client.get("search/tweets", {
    q: getRandomItemFromArray(ACTIONS),
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
