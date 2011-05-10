function console_log(obj) {
  //console.log(obj);
}

uniqueID = (function() {
  var id = 0;
  return function() {return id++; };
})();

function formatDateString(dateStr) {
  var date = new Date(dateStr);
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  if (date > now) // the same day
    return date.toLocaleTimeString();
  else
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

var requests = [];

var XPATH_COMMENTS = "div[@class='body']/div[@class='comments']/div[contains(@class, 'comment')]";

window.fixTimestamps = function(subtree) {
  var entries = document.evaluate(
      ".//*[self::div and contains(@class, 'entry') and not(contains(@class, 'private')) and not(@unhide)]",
      subtree,
      null,
      XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
      null);

  if (entries.snapshotLength == 0)
    return;

  var i;
  var url = "";
  if (entries.snapshotLength == 1) {
    // build url
    url = "http://friendfeed-api.com/v2/entry/e/" + entries.snapshotItem(0).getAttribute("eid") + "?callback=?";
  } else {
    url = "http://friendfeed-api.com/v2/entry?id=";

    for (i = 0; i < entries.snapshotLength; i++) {
      // append entry id
      url = url.concat("e/" + entries.snapshotItem(i).getAttribute("eid") + ",");
    }

    // remove trailing ","
    url = url.substring(0, url.length - 1);
    // for jsonp
    url = url.concat("&callback=?");
  }

  var uid = uniqueID();

  var onResponse = function(_response) {
      console_log(_response);
      var requestIndex;
      if (!_response || !_response.responseText) {
        console_log("Wrong JSON response.");
        requestIndex = requests.indexOf(request);
        if (requestIndex >= 0)
          requests.splice(requestIndex, 1);
        return;
      }

      var response = {};
      try {
        // remove leading '?(' and trailing ')'
        response = JSON.parse(_response.responseText.slice(2, _response.responseText.length - 1));
      } catch (ex) {
        console_log(ex);
      }
      if (!response || (!response.comments && !response.entries)) {
        console_log("Wrong JSON response.");
        requestIndex = requests.indexOf(request);
        if (requestIndex >= 0)
          requests.splice(requestIndex, 1);
        return;
      }

      console_log("Got response from request #" + uid);

      var jsonEntries = [];
      if (response.comments)
        jsonEntries = [response];
      else
        jsonEntries = response.entries;

      var quoteIndex;
      var j;
      var jsonEntry;
      var a_date;
      var quotes;
      var commentId;
      var entry;
      var quote;

      for (i = 0; i < entries.snapshotLength; i++) {
        try {
          entry = entries.snapshotItem(i);
          console_log(entry);

          jsonEntry = {};
          for (j = 0; j < jsonEntries.length; j++) {
            if (jsonEntries[j].id.substring(2) == entry.getAttribute("eid")) {
              jsonEntry = jsonEntries[j];
              // remove this entry from array
              jsonEntries.splice(j, 1);
              break;
            }
          }

          if (!jsonEntry)
            continue;


          a_date = entry.getElementsByClassName("date")[0];
          a_date.setAttribute("title", formatDateString(jsonEntry.date));

          quotes = entry.getElementsByClassName("quote");

          if (!quotes || !quotes.length || quotes.length == 0)
            continue;

          for (quoteIndex = 0; quoteIndex < quotes.length; quoteIndex++) {
            quote = quotes[quoteIndex];
            commentId = quote.parentElement.id.replace("-", "/");
            console_log("commentId = " + commentId);
            for (j = 0; j < jsonEntry.comments.length; j++) {
              if (jsonEntry.comments[j].id.indexOf(commentId) > 0) {
                quote.setAttribute("title", formatDateString(jsonEntry.comments[j].date));
                break;
              }
            }
          }
        } catch (ex) {
          console_log(ex);
        }
      }

      requestIndex = requests.indexOf(request);
      if (requestIndex >= 0)
        requests.splice(requestIndex, 1);
    };

  var request = {action : 'fetchFrfApi', url : url};
  requests.push(request);
  console_log(request);
  try {
    chrome.extension.sendRequest(request, onResponse);
  } catch (ex) {
    console_log("Caught exception: " + ex);
  }
};

window.fixTimestamps(document);

var node_inserted_handler = function(event) {
    if (window.IN_STM_HANDLER)
      return;
    if (requests.length > 0)
      return;

    window.IN_STM_HANDLER = true;

    try {
        window.fixTimestamps(event.target)
    } catch (ex) {
        console_log(ex);
    }

    window.IN_STM_HANDLER = false;
};

document.addEventListener("DOMSubtreeModified", node_inserted_handler, false);
