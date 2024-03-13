const FETCHED_EVENT_TABLE = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("fetched_event");
const CONNPASS_API_ENDPOINT = "https://connpass.com/api/v1/event/?order=3&count=100"
const LINE_TOKEN = PropertiesService.getScriptProperties().getProperty("LINE_TOKEN");
const LINE_BROADCAST_ENDPOINT = "https://api.line.me/v2/bot/message/broadcast";

// main関数
const pushNewConnpassEvent = () => {
  const now = new Date();

  const result = fetchEvents();

  // 通知済みのイベントを取得
  const pushedEventIds = findPushedEventIds();

  // 通知済みのイベントを除外
  const originalNewEvents = removePushedEvents(result.events, pushedEventIds);

  // 「もくもく」が含まれるイベントを除外
  const newEvents = eliminateEventsIncludingWord(originalNewEvents, "もくもく");

  const slicedNewEvents = sliceByNumber(newEvents, 5);

  slicedNewEvents.forEach((events) => {
    // push用のフォーマットを作成
    const pushedContents = events.map((e) => createPushFormat(e));

    // 未通知のイベントをLINEに通知
    const isSuccess = pushToLine(pushedContents);

    if (isSuccess) {
      // 通知済みのイベントを保存
      events.forEach((e) => {
        savePushedEventId(e.event_id, now);
      });
    }

  });

}

const fetchEvents = () => {
  const response = UrlFetchApp.fetch(CONNPASS_API_ENDPOINT);
  return JSON.parse(response.getContentText());
}

const readAllRecord = (sheet) => {
  if (sheet.getLastRow() < 2) {
    return [];
  }

  // const headers = getHeaders(sheet);
  const range = sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn());
  return range.getValues();
}

const findPushedEventIds = () => {
  const records = readAllRecord(FETCHED_EVENT_TABLE);
  return records.map((r) => r[0]);
}

const savePushedEventId = (id, date) => {
  const newRow = FETCHED_EVENT_TABLE.getLastRow() + 1;

  const rangeForId = FETCHED_EVENT_TABLE.getRange(`A${newRow}`);
  rangeForId.setValue(id);

  const rangeForDate = FETCHED_EVENT_TABLE.getRange(`B${newRow}`);
  rangeForDate.setValue(date);
}

const removePushedEvents = (events, pushedEventIds) => {
  return events.filter((e) => {
    return !pushedEventIds.includes(e.event_id);
  });
}

const eliminateEventsIncludingWord = (events, word) => {
  return events.filter((e) => {
    return !e.title.includes(word);
  });
}

const createPushFormat = (event) => {
  const title = event.title;
  // const description = event.description;
  const eventUrl = event.event_url;
  const startedAt = formatDate(isoToDate(event.started_at));
  const endedAt = formatDate(isoToDate(event.ended_at));
  const place = event.place;

  return `${title}\n${startedAt} ~ ${endedAt} at ${place}\n${eventUrl}`;
}

const formatDate = (date) => {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
}

const isoToDate = (timestampStr) => {
  const timestampMs = Date.parse(timestampStr);
  return new Date(timestampMs);  
}

const pushToLine = (contents) => {
  var isSuccess = true;

  const payload = {
    messages: contents.map((c) => {
      return {
        type: 'text', 
        text: c
      }
    })
  };

  const param = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    payload: JSON.stringify(payload),
  };

  try {
    UrlFetchApp.fetch(LINE_BROADCAST_ENDPOINT, param);
  } catch (e) {
    console.log(e);
    isSuccess = false;
  }

  return isSuccess;
};

const sliceByNumber = (array, number) => {
  const length = Math.ceil(array.length / number)
  return new Array(length).fill().map((_, i) =>
    array.slice(i * number, (i + 1) * number)
  )
}
