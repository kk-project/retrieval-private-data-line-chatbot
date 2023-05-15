import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();

import https from "https";
import express from "express";
import crypto from "crypto";

import retrieval_qa from "./retrieval_qa.js";

const PORT = process.env.PORT || 3000;
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

const app = express();

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.get("/", (req, res) => {
  res.sendStatus(200);
});

app.post("/webhook", async (req, res) => {
  // 署名を検証する
  const channelSecret = CHANNEL_SECRET;
  const body = JSON.stringify(req.body);
  const signature = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");
  if (req.headers["x-line-signature"] !== signature) {
    // 署名が不正な場合は後続の処理は行わない
    res.send("Signature is invalid.");
    return;
  }

  res.send("HTTP POST request sent to the webhook URL!");

  // ユーザーがボットにメッセージを送った場合、返信メッセージを送る
  if (req.body.events[0]?.type === "message") {
    const inputText = req.body.events[0].message.text;

    const response = await retrieval_qa({ query: inputText });
    const sourceLinkList = response.sourceDocuments.map((doc) => {
      return {
        type: "button",
        action: {
          type: "uri",
          label: doc.metadata.title || doc.metadata.url,
          uri: doc.metadata.url,
        },
      };
    });

    // 文字列化したメッセージデータ
    const dataString = JSON.stringify({
      replyToken: req.body.events[0].replyToken,
      messages: [
        {
          type: "flex",
          altText: "Link Message",
          contents: {
            type: "bubble",
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: `${response.text} \n`,
                  wrap: true,
                  color: "#000000",
                },
                {
                  type: "text",
                  text: "ドキュメントリンク:",
                  weight: "bold",
                  color: "#000000",
                },
                ...sourceLinkList,
              ],
            },
          },
        },
      ],
    });

    // リクエストヘッダー
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + LINE_ACCESS_TOKEN,
    };

    // リクエストに渡すオプション
    const webhookOptions = {
      hostname: "api.line.me",
      path: "/v2/bot/message/reply",
      method: "POST",
      headers: headers,
      body: dataString,
    };

    // リクエストの定義
    const request = https.request(webhookOptions, (res) => {
      res.on("data", (d) => {
        process.stdout.write(d);
      });
    });

    // エラーをハンドル
    request.on("error", (err) => {
      console.error(err);
    });

    // データを送信
    request.write(dataString);
    request.end();
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening at http://localhost:${PORT}`);
});
