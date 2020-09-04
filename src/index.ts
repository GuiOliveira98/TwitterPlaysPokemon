import Twitter from "twitter";
import concatStream from "concat-stream";
import axios from "axios";
require("dotenv").config();

const MAX_WAIT_FOR_REPLIES_IN_MINUTES = 60;
const WAIT_BETWEEN_TWEETS_IN_MINUTES = 5;

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

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
  | "LOAD_SAVE"
  | "DOWNLOAD_SAVE"
  | "SCREENSHOT";

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
  doubleModifier: boolean;
  tripleModifier: boolean;
};

const API = process.env.API;
async function downloadScreenshot() {
  var fullImage = null;

  const response = await axios.post(
    `${API}/execute`,
    {
      command: "screenshot",
    },
    {
      responseType: "stream",
    }
  );

  response.data.pipe(
    concatStream(function onStreamFinished(image) {
      fullImage = image;
    })
  );

  while (fullImage === null) await sleep(100);
  return fullImage;
}

async function executeAction(action: Action) {
  await axios.post(`${API}/execute`, {
    command: action,
  });
}

mainLoop();
async function mainLoop() {
  let lastTweet: Tweet | null = null;

  while (true) {
    var lastTweetId = lastTweet?.id ?? process.env.LAST_TWEET_ID;

    console.log("Receiving order...");
    const order = await findNextTweetCommand(lastTweetId);
    console.log("Order received!", order);

    console.log("Applying action...");
    await applyAction(order.action, order.doubleModifier, order.tripleModifier);
    await executeAction("DOWNLOAD_SAVE");

    console.log("Tweeting...");
    lastTweet = await tweet(order, lastTweetId);
    console.log("Tweeted!");

    for (var i = 0; i < WAIT_BETWEEN_TWEETS_IN_MINUTES; i++) {
      console.log(`${WAIT_BETWEEN_TWEETS_IN_MINUTES - i} minutes remaining...`);
      await sleep(60 * 1000);
    }
  }
}

async function tweet(order: Tweet, lastTweetId: string) {
  try {
    const screenshot = await downloadScreenshot();

    const media = await client.post("media/upload", {
      media: screenshot,
    });

    var status = {
      in_reply_to_status_id: lastTweetId,
      username: "TweetsPlaysPkmn",
      media_ids: media.media_id_string,
      status: `Button ${order.action} pressed ${
        order.tripleModifier
          ? "3 times "
          : order.doubleModifier
          ? "2 times "
          : ""
      }by @${order.username}!
[by tweeting a message with the word "${order.action}"]

What should we do next?
[Reply with a button to be pressed]

#Pokemon #PokemonMastersEX
${order.link}`,
    };

    const tweet = await client.post("statuses/update", status);
    const normalizedTweet = normalizeTweet(tweet);

    return normalizedTweet;
  } catch (error) {
    throw new Error(`Error on tweet: ${error}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyAction(
  action: Action,
  doubleModifier: boolean,
  tripleModifier: boolean
) {
  const timesToBeApplied = tripleModifier ? 3 : doubleModifier ? 2 : 1;
  for (var i = 0; i < timesToBeApplied; i++) {
    await executeAction(action);
    await sleep(5000);
  }
}

async function findNextTweetCommand(lastTweetId: string): Promise<Tweet> {
  const mentionWithAction = await getMentionWithAction(lastTweetId);

  return mentionWithAction !== null
    ? mentionWithAction
    : await getRandomCommandTweet();
}

async function getMentionWithAction(
  lastTweetId: string
): Promise<Tweet | null> {
  const waitTimeBetweenChecks = 60 * 1000;

  for (
    var time = 0;
    time < MAX_WAIT_FOR_REPLIES_IN_MINUTES * 60 * 1000;
    time += waitTimeBetweenChecks
  ) {
    const mentions = await getRepliesToTweet(lastTweetId);
    const mentionsWithActions = mentions.filter(
      (tweet) => tweet.action !== null
    );

    if (mentionsWithActions.length > 0) {
      return getRandomItemFromArray(mentionsWithActions);
    } else {
      await sleep(waitTimeBetweenChecks);
    }
  }

  return null;
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

  const doubleModifier = text.toLowerCase().includes("double");
  const tripleModifier = text.toLowerCase().includes("triple");

  return {
    id,
    username,
    link,
    inReplyToStatusId,
    text,
    action,
    doubleModifier,
    tripleModifier,
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
