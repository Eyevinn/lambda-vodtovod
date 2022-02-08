import { ALBHandler, ALBResult, ALBEvent } from "aws-lambda";
import { HLSVod, IPlaylistEntry } from "@eyevinn/hls-vodtovod";
import fetch from "node-fetch";
import xmlparser from "fast-xml-parser";
import Debug from "debug";
const debug = Debug("vodtovod");

export const handler: ALBHandler = async (
  event: ALBEvent
): Promise<ALBResult> => {
  let response: ALBResult;
  if (event.path.match("/v2v*") && event.httpMethod === "OPTIONS") {
    debug("Requesting Options...");
    response = await handleOptionsRequest();
  } else if (event.path === "/v2v/master.m3u8") {
    debug("Requesting Multivariant Playlist...");
    response = await handleMultiVariantRequest(event);
  } else if (event.path === "/v2v/media.m3u8") {
    debug("Requesting Media Playlist...");
    response = await handleMediaManifestRequest(event);
  }
  return response;
};

const handleOptionsRequest = async () => {
  try {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Origin",
        "Access-Control-Max-Age": "86400",
      },
    };
  } catch (exc) {
    console.error(exc);
    return generateErrorResponse({
      code: 500,
      message: "Failed to respond to OPTIONS request",
    });
  }
};

const handleMultiVariantRequest = async (event: ALBEvent) => {
  try {
    const encodedMrssUri = event.queryStringParameters.mrss;
    debug(`(multivariant) Creating playlist from MRSS`);
    const playlist: IPlaylistEntry[] = await createPlaylistFromMRSS(
      new URL(decodeURIComponent(encodedMrssUri))
    );
    const hlsVod = new HLSVod(playlist);
    const ts1 = Date.now();
    debug(`(multivariant) Loading HLSVod...`);
    await hlsVod.load();
    debug(`(multivariant) ...Loaded HLSVod in (${Date.now() - ts1})ms`);
    debug(`(multivariant) Generating Multivariant Playlist`);
    return generateManifestResponse(
      hlsVod.toString(
        (bw) => "media.m3u8?bw=" + bw + "&mrss=" + encodedMrssUri,
        (gl) => "media.m3u8?audiotrack=" + gl + "&mrss=" + encodedMrssUri
      )
    );
  } catch (exc) {
    console.error(exc);
    return generateErrorResponse({
      code: 500,
      message: "Failed to generate multivariant manifest",
    });
  }
};

const handleMediaManifestRequest = async (event: ALBEvent) => {
  try {
    let bw: string;
    let audiotrack: string;

    if (event.queryStringParameters.audiotrack) {
      audiotrack = event.queryStringParameters.audiotrack;
    } else if (event.queryStringParameters.bw) {
      bw = event.queryStringParameters.bw;
    } else {
      console.error(
        "Warning! Niether 'audiotrack' or 'bw' were included in search params"
      );
    }
    const mediaType = bw ? "video" : "audio";
    const encodedMrssUri = event.queryStringParameters.mrss;
    debug(`(media) Creating vod-playlist from MRSS`);
    const playlist: IPlaylistEntry[] = await createPlaylistFromMRSS(
      new URL(decodeURIComponent(encodedMrssUri))
    );

    const hlsVod = new HLSVod(playlist);
    const ts1 = Date.now();
    debug(`(media-${mediaType}) Loading HLSVod...`);
    await hlsVod.load();
    debug(`(media-${mediaType}) ...Loaded HLSVod in (${Date.now() - ts1})ms`);
    if (audiotrack) {
      const [_, groupId, language] = audiotrack.match(/^(\S+)-(\S+)$/);
      debug(
        `(media-${mediaType}) Generating Media Playlist for->(groupID:${groupId})(lang:${language})`
      );
      return generateManifestResponse(
        hlsVod.getAudioVariant(groupId, language).toString()
      );
    }
    debug(`(media-${mediaType}) Generating Media Playlist for->(bw:${bw})`);
    return generateManifestResponse(hlsVod.getVariant(bw).toString());
  } catch (exc) {
    console.error(exc);
    return generateErrorResponse({
      code: 500,
      message: "Failed to generate media manifest",
    });
  }
};

const createPlaylistFromMRSS = async (
  mrssUrl: URL
): Promise<IPlaylistEntry[]> => {
  const playlist: IPlaylistEntry[] = [];
  debug(`Fetching -> ${mrssUrl.href}`);
  const res = await fetch(mrssUrl.href);
  if (!res.ok) {
    debug(`Failed to fetch MRSS: ${res.status}:${res.statusText}`);
    throw new Error(`Failed to fetch MRSS: ${res.status}:${res.statusText}`);
  } else {
    debug(`Fetch Success!`);
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
};

const generateManifestResponse = (manifest: string) => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Access-Control-Allow-Origin": "*",
    },
    body: manifest,
  };
};

const generateErrorResponse = ({ code: code, message: message }) => {
  let response = {
    statusCode: code,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: undefined,
  };
  if (message) {
    response.body = JSON.stringify({ reason: message });
  }
  return response;
};
