// Deterministic behavior for QA JOO self-tests. "?bug=1" injects a regression on purpose.
(function () {
  var form = document.getElementById("campaign-form");
  var error = form.querySelector(".form-error");
  var button = document.getElementById("analyze-button");
  var result = document.getElementById("result");
  var buggy = new URLSearchParams(location.search).get("bug") === "1";
  var privateHost = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?)/;

  function fail(message) {
    error.textContent = message;
    error.hidden = false;
    result.hidden = true;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    error.hidden = true;
    var raw = document.getElementById("campaign-url").value.trim();
    var url;
    try {
      url = new URL(raw);
    } catch {
      return fail("Enter a valid public campaign URL.");
    }
    if (!/^https?:$/.test(url.protocol)) return fail("Enter a valid public campaign URL.");
    if (!buggy && privateHost.test(url.hostname)) {
      return fail("The campaign URL must be accessible from the public internet.");
    }
    var photos = Number(document.getElementById("photo-count").value);
    if (!(photos >= 1 && photos <= 20)) return fail("Photo count must be between 1 and 20.");
    button.disabled = true;
    button.textContent = "Analyzing…";
    setTimeout(function () {
      var keywords = document.getElementById("keywords").value.split(",").map(function (k) { return k.trim(); }).filter(Boolean);
      var list = result.querySelector("ul");
      list.innerHTML = "";
      ["Source: " + url.hostname, "Required photos: " + photos].concat(keywords.map(function (k) { return "Keyword: " + k; })).forEach(function (text) {
        var item = document.createElement("li");
        item.textContent = text;
        list.appendChild(item);
      });
      result.hidden = false;
      button.disabled = false;
      button.textContent = "Analyze";
    }, 300);
  });
})();
