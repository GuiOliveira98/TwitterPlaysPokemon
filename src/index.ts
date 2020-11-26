import Twitter from "twitter";
import concatStream from "concat-stream";
import axios from "axios";
require("dotenv").config();

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
  actions: Action[];
  favorited: boolean;
  retweeted: boolean;
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

async function sendSlackMessage(text: string) {
  axios.post(process.env.SLACK_WEBHOOK, { text });
}

async function mainLoop() {
  let lastTweet: Tweet | null = null;

  while (true) {
    var lastTweetId = lastTweet?.id ?? process.env.LAST_TWEET_ID;

    console.log("Receiving order...");
    const order = await findNextTweetCommand(lastTweetId);
    console.log("Order received!", order);

    console.log("Applying action...");
    await applyAction(order.actions);
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
      status: generateTweetStatus(order),
    };

    const tweet = await client.post("statuses/update", status);
    const normalizedTweet = normalizeTweet(tweet);

    return normalizedTweet;
  } catch (error) {
    throw new Error(`Error on tweet: ${error.message}`);
  }
}

function generateTweetStatus(order: Tweet) {
  const buttonsPressed = order.actions.length;
  if (buttonsPressed == 1) {
    const text = `Player @${order.username} pressed ${order.actions[0]}!
[by tweeting the word ${order.actions[0]}]
    
What should we do next?

#Pokemon #PokemonMastersEX
${order.link}`;

    return text;
  }

  const text = `Player @${order.username} pressed ${
    order.actions[0]
  } and other ${buttonsPressed - 1} inputs!
[by tweeting the word ${order.actions[0]} and other ${
    buttonsPressed - 1
  } keywords]
    
What should we do next?

#Pokemon #PokemonMastersEX
${order.link}`;

  return text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyAction(actions: Action[]) {
  for (var i = 0; i < actions.length; i++) {
    await executeAction(actions[i]);
    await sleep(5000);
  }
}

async function findNextTweetCommand(lastTweetId: string): Promise<Tweet> {
  console.log("Trying to get a reply with an action...");
  const mentionWithAction = await getMentionWithAction(lastTweetId);
  return mentionWithAction;
}

async function getMentionWithAction(
  lastTweetId: string
): Promise<Tweet | null> {
  while (true) {
    const mentions = await getRepliesToTweet(lastTweetId);
    const mentionsWithActions = mentions.filter(
      (tweet) => tweet.actions.length > 0
    );

    if (mentionsWithActions.length > 0) {
      console.log("Found tweet reply!");
      return getRandomItemFromArray(mentionsWithActions);
    } else {
      await sleep(30 * 1000);
    }
  }
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
  const actions = getActionsFromText(text);
  const retweeted = raw.retweeted;
  const favorited = raw.favorited;

  return {
    id,
    username,
    link,
    inReplyToStatusId,
    text,
    actions,
    retweeted,
    favorited,
  };
}

function getActionsFromText(text: string): Action[] {
  const words = text.toUpperCase().split(/[^a-zA-Z]/);
  const actions = words.filter((word) =>
    PLAYER_ACTIONS.find((action) => action === word)
  ) as Action[];

  return actions.slice(0, 10);
}

main();
async function main() {
  try {
    await mainLoop();
  } catch (error) {
    console.log("Ocorreu um erro!", error);

    const slackMessage = `Ocorreu um erro no bot Twitter Plays Pokémon!
Erro da Mensagem: ${error.message}`;
    await sendSlackMessage(slackMessage);
  }
}
