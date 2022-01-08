import { ALBHandler, ALBResult, ALBEvent } from "aws-lambda";
import { HLSVod, IPlaylistEntry } from "@eyevinn/hls-vodtovod";
import fetch from "node-fetch";
import xmlparser from "fast-xml-parser";

export const handler: ALBHandler = async (event: ALBEvent): Promise<ALBResult> => {
  let response: ALBResult;
  if (event.path.match("/v2v*") && event.httpMethod === "OPTIONS") {
    response = await handleOptionsRequest();
  } else if(event.path === "/v2v/master.m3u8") {
    response = await handleMultiVariantRequest(event);
  } else if(event.path === "/v2v/media.m3u8") {
    response = await handleMediaManifestRequest(event);
  }
  return response;
};

const handleOptionsRequest = async () => {
  try {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Origin',
        'Access-Control-Max-Age': '86400',
      }
    }
  } catch (exc) {
    console.error(exc);
    return generateErrorResponse({ code: 500, message: "Failed to respond to OPTIONS request" });
  }
};

const handleMultiVariantRequest = async (event: ALBEvent) => {
  try {
    const encodedMrssUri = event.queryStringParameters.mrss;
    const playlist: IPlaylistEntry[] = await createPlaylistFromMRSS(new URL(decodeURIComponent(encodedMrssUri)));
    const hlsVod = new HLSVod(playlist);
    await hlsVod.load();
    return generateManifestResponse(hlsVod.toString((bw) => "media.m3u8?bw=" + bw + "&mrss=" + encodedMrssUri));
  } catch (exc) {
    console.error(exc);
    return generateErrorResponse({ code: 500, message: "Failed to generate multivariant manifest" });
  }
}

const handleMediaManifestRequest = async (event: ALBEvent) => {
  try {
    const bw = event.queryStringParameters.bw;
    const encodedMrssUri = event.queryStringParameters.mrss;
    const playlist: IPlaylistEntry[] = await createPlaylistFromMRSS(new URL(decodeURIComponent(encodedMrssUri)));
    const hlsVod = new HLSVod(playlist);
    await hlsVod.load();
    return generateManifestResponse(hlsVod.getVariant(bw).toString());
  } catch (exc) {
    console.error(exc);
    return generateErrorResponse({ code: 500, message: "Failed to generate media manifest" });
  }
}

const createPlaylistFromMRSS = async (mrssUrl: URL): Promise<IPlaylistEntry[]> => {
  const playlist: IPlaylistEntry[] = [];
  const res = await fetch(mrssUrl.href);
  if (!res.ok) {
    throw new Error(`Failed to fetch MRSS: ${res.status}:${res.statusText}`);
  } else {
    const xmlString = await res.text();
    const xmlJson = xmlparser.parse(xmlString);
    for (let i = 0; i < xmlJson.feed.entry.length; i++) {
      const entry = xmlJson.feed.entry[i];
      const playlistEntry: IPlaylistEntry = {
        id: entry.id,
        uri: entry.link,
      };
      if (entry.title) {
        playlistEntry.title = entry.title;
      }
      playlist.push(playlistEntry);
    }
  }
  return playlist;
}

const generateManifestResponse = (manifest: string) => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Access-Control-Allow-Origin": "*",
    },
    body: manifest
  };
}

const generateErrorResponse = ({ code: code, message: message }) => {
  let response = {
    statusCode: code,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: undefined,
  };
  if (message) {
    response.body = JSON.stringify({ reason: message });
  }
  return response;
};
