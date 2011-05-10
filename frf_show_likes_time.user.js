// ==UserScript==
// @name           Friendfeed likes sorter
// @namespace      ivan.dyachkoff
// @include        http*://friendfeed.com/*
// @include        http*://friendfeed-api.com/*
// @author         Ivan Dyachkoff
// @description    Sorts likes by date. Adds 'Show likes time' link to show timestamp for each like.
// @version        0.2
// ==/UserScript==

function console_log(obj) {
  GM_log(obj);
}

function formatDate(date) {
  var month = (date.getMonth() + 1) < 10 ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1);
  var day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
  var hours = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
  var minutes = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
  var seconds = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();
  return date.getFullYear() + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
}

function showLikesTime(event) {
//  console_log("showLikesTime");
  try {
    var likesSpan = event.currentTarget.parentNode.parentNode.firstChild;
    var dateSpan;
//    console_log(likesSpan);
    for (var i = 0; i < likesSpan.childNodes.length; i++) {
      var childNode = likesSpan.childNodes[i];
//      console_log(childNode);
      if (childNode.className == "l_profile" &&
          childNode.nextSibling.nodeType == 3) {
        dateSpan = document.createElement("span");
        dateSpan.className = "like_time";
        dateSpan.innerHTML = " [" + formatDate(new Date(childNode.getAttribute("date"))) + "]";
        likesSpan.insertBefore(dateSpan, childNode.nextSibling);
      }
    }

    this.parentNode.parentNode.removeChild(this.parentNode);
  } catch (ex) {
    console_log(ex);
  }
  event.preventDefault();
}

uniqueID = (function() {
  var id = 0;
  return function() {return id++; };
})();

var requests = [];

var XPATH_LIKES = "div[@class='body']/div[@class='likes']/span[@class='lbody']/a";

window.sortLikes = function(subtree) {

  var entries = document.evaluate(
      ".//*[self::div and contains(@class, 'entry') and not(contains(@class, 'private')) and not(@unhide)]",
      subtree,
      null,
      XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
      null);

//  console_log("entries.snapshotLength = " + entries.snapshotLength);

  if (entries.snapshotLength == 0)
    return;

  var i;
  var likes;
  var url = "";
  if (entries.snapshotLength == 1) {
    likes = document.evaluate(XPATH_LIKES, entries.snapshotItem(0), null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
    // nothing to do when single entry and no likes
    if (likes.snapshotLength == 0)
      return;

    // build url
    url = "http://friendfeed-api.com/v2/entry/e/" + entries.snapshotItem(0).getAttribute("eid") + "?callback=?";
  } else {

    url = "http://friendfeed-api.com/v2/entry?id=";

    for (i = 0; i < entries.snapshotLength; i++) {
      likes = document.evaluate(XPATH_LIKES, entries.snapshotItem(i), null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
      // skip entries with no likes
      if (likes.snapshotLength == 0)
        continue;

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
//      console_log(_response);
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
      if (!response || (!response.likes && !response.entries)) {
        console_log("Wrong JSON response.");
        requestIndex = requests.indexOf(request);
        if (requestIndex >= 0)
          requests.splice(requestIndex, 1);
        return;
      }

      console_log("Got response from request #" + uid);

      var jsonEntries = [];
      if (response.likes)
        jsonEntries = [response];
      else
        jsonEntries = response.entries;

      var likeIndex;
      var j;
      var jsonEntry;
      var likesArr;
      var entry;
      var like;
      var userid;
      var likesBody;
      var sortedLikes = "";
      var textAnd = "";
      var textLikedThis = "";
      var textNodes = [];
      var showLikesTimeElement;
      var showLikesTimeSpan;
      var xmlSerializer = new XMLSerializer();

      for (i = 0; i < entries.snapshotLength; i++) {
        try {
          entry = entries.snapshotItem(i);
          likes = {};
          try {
            likes = document.evaluate(XPATH_LIKES, entry, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
          } catch (ex) {
            console_log(ex);
          }

//          console_log("likes.snapshotLength = " + likes.snapshotLength);
          if (!likes || !likes.snapshotLength || likes.snapshotLength == 0)
            continue;

          likesArr = [];
          for (likeIndex = 0; likeIndex < likes.snapshotLength; likeIndex++) {
            if (likes.snapshotItem(likeIndex).className == "l_profile" ||
                likes.snapshotItem(likeIndex).className == "l_expandlikes")
              likesArr.push(likes.snapshotItem(likeIndex));
          }

          jsonEntry = {};
          for (j = 0; j < jsonEntries.length; j++) {
            if (jsonEntries[j].id.substring(2) == entry.getAttribute("eid")) {
              jsonEntry = jsonEntries[j];
              // remove this entry from array
              jsonEntries.splice(j, 1);
              break;
            }
          }

          if (!jsonEntry || !jsonEntry.likes)
            continue;

          // set "date" attribute from JSON
          for (likeIndex = 0; likeIndex < likesArr.length; likeIndex++) {
            like = likesArr[likeIndex];
            // skip "expand likes" entry
            if (like.hasAttribute("class") && like.getAttribute("class") == "l_expandlikes") {
              like.setAttribute("date", 0);
              continue;
            }
            userid = like["href"].substring(like["href"].lastIndexOf("/") + 1);
            for (j = 0; j < jsonEntry.likes.length; j++) {
              if (jsonEntry.likes[j].from.id == userid) {
                like.setAttribute("date", jsonEntry.likes[j].date);
                jsonEntry.likes.splice(j, 1);
                break;
              }
            }
          }

          likesArr.sort(function(a, b) {
            return Date.parse(b.getAttribute("date")) - Date.parse(a.getAttribute("date"));
          });

          likesBody = entry.getElementsByClassName("lbody")[0];

          sortedLikes = "";
          textAnd = "";
          textLikedThis = "";

          textNodes = [];
          for (j = likesBody.childNodes.length - 1; j >= 0 && textNodes.length < 2; j--) {
            if (likesBody.childNodes[j].nodeType == 3)
              textNodes.push(likesBody.childNodes[j]);
          }

          if (textNodes.length > 0) {
            textLikedThis = textNodes[0].data;
            if (textNodes.length == 2)
              textAnd = textNodes[1].data;
          }

          for (likeIndex = 0; likeIndex < likesArr.length; likeIndex++) {
            if (likeIndex == likesArr.length - 2)
              sortedLikes += xmlSerializer.serializeToString(likesArr[likeIndex]) + textAnd;
            else if (likeIndex == likesArr.length - 1)
              sortedLikes += xmlSerializer.serializeToString(likesArr[likeIndex]) + textLikedThis;
            else
              sortedLikes += xmlSerializer.serializeToString(likesArr[likeIndex]) + ", ";
          }

          likesBody.innerHTML = sortedLikes;

          if (likesBody.parentNode.getElementsByClassName("show_likes_time").length == 0) {
            showLikesTimeElement = document.createElement("a");
            showLikesTimeElement.href = "#";
            showLikesTimeElement.className = "l_show_likes_time";
            showLikesTimeElement.innerHTML = ">>>";
            showLikesTimeElement.addEventListener("click", showLikesTime, false);
            showLikesTimeSpan = document.createElement("span");
            showLikesTimeSpan.className = "show_likes_time";
            showLikesTimeSpan.appendChild(document.createTextNode(" ("));
            showLikesTimeSpan.appendChild(showLikesTimeElement);
            showLikesTimeSpan.appendChild(document.createTextNode(")"));
            likesBody.parentNode.appendChild(showLikesTimeSpan);
          }
        } catch (ex) {
          console_log(ex);
        }
      }

      requestIndex = requests.indexOf(request);
      if (requestIndex >= 0)
        requests.splice(requestIndex, 1);
    };

  var request = {method: 'GET', url: url, onload: onResponse};
  requests.push(request);
//  console_log(request.url);
  try {
    setTimeout(function() {GM_xmlhttpRequest(request)}, 0);
  } catch (ex) {
    console_log("Caught exception: " + ex);
  }
};

window.sortLikes(document);

var node_inserted_handler = function(event) {
    if (window.IN_STM_HANDLER)
      return;
    if (requests.length > 0)
      return;

    window.IN_STM_HANDLER = true;

    try {
        window.sortLikes(event.target)
    } catch (ex) {
        console_log(ex);
    }

    window.IN_STM_HANDLER = false;
};

document.addEventListener("DOMSubtreeModified", node_inserted_handler, false);
