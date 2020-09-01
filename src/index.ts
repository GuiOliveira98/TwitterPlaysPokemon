import Twitter from "twitter";
require("dotenv").config();

const client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

listenTwitterForKeyword("up");

function listenTwitterForKeyword(keyword: string) {
  var stream = client.stream("statuses/filter", { track: keyword });
  stream.on("data", function (event) {
    if (event.limit) return;
    console.log(event.text);
  });

  stream.on("error", function (error) {
    throw error;
  });
}
