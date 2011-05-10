window.frf_comments_ex = function(subtree) {
    var all_bubbles, this_bubble;
    all_bubbles = document.evaluate(
        ".//*[self::div and (@class='quote')]",
        subtree,
        null,
        XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
        null);

	var imageUrl = chrome.extension.getURL("images/clipboard-16x16.png");
    for (var i = 0; i < all_bubbles.snapshotLength; i++) {
        this_bubble = all_bubbles.snapshotItem(i);
		if (this_bubble.parentNode.getElementsByClassName("copy-url").length > 0)
			continue;
		if (this_bubble.parentNode.className.indexOf('bottomcomment') >= 0)
			continue;
		var copyUrlDiv = document.createElement("div");
		copyUrlDiv.className = "copy-url";
		this_bubble.parentNode.insertBefore(copyUrlDiv, this_bubble);
        (function(buble) { copyUrlDiv.onclick = function() {
			try {
				var dateUrl = buble.parentNode.parentNode.parentNode.getElementsByClassName("date").item(0);
				var text = dateUrl.href + "#" + buble.parentNode.id;
			    chrome.extension.sendRequest(
			      {
			        "type" : "reformat",
			        "text" : text
			      }
			    );
			} catch (ex) {
				console.log("Caught exception: " + ex);
			}
        }})(this_bubble);
    }
};

window.frf_comments_ex(document);

var node_inserted_handler = function(event) {
    if (window.IN_SM) return;
    window.IN_SM = true;

    window.frf_comments_ex(event.target)

    window.IN_SM = false;
};

document.addEventListener("DOMSubtreeModified", node_inserted_handler, false);
