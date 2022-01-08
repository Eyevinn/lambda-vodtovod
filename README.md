# lambda-vod2vod

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Slack](http://slack.streamingtech.se/badge.svg)](http://slack.streamingtech.se)

Lambda function to stitch multiple VODs into a single VOD.

The playlist of VODs is created from an MRSS playlist

## Setup

```
npm install
npm run build
```

## Run Lambda locally

```
node dev.server.js
```

Try it out by providing an URL encoded URL to an MRSS, for example: `https://testcontent.eyevinn.technology/mrss/example.mrss`

Open a browser with the following URL to a local dev server: `http://localhost:8000/v2v/master.m3u8?mrss=https%3A%2F%2Ftestcontent.eyevinn.technology%2Fmrss%2Fexample.mrss`

# About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!
