/* Vars */

const qaClasses = ".question,.answer,.question-new,.answer-new";

/* Utils */

/*
const updateStore = (item, key, value) => {
  var it = localStorage.getItem(item);
  it = it ? JSON.parse(it) : {};
  console.log(key);
  console.log(it);
  it[key]["text"] = value;
  localStorage.setItem(item, JSON.stringify(it));
};
*/

const debounce = (func, wait = 300) => {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Keep \n's and \r's
const esc = (str) => {
  return str.replace(/\n/g, "&#92;n").replace(/\r/g, "&#92;r");
};

// Convert \\n and \\r back
const unEsc = (str) => {
  return str.replaceAll("\\n", "\n").replaceAll("\\r", "\r");
};

// Convert json to jsonl
const jsonToJsonl = (json) => {
  return json
    .map((el) => {
      return JSON.stringify(el);
    })
    .join("\n");
};

// Convert jsonl to json
const jsonlToJson = (jsonl) => {
  const lines = jsonl.split(/\n/);
  let data = [];
  let error = false;
  lines.forEach((line) => {
    let object;
    try {
      object = JSON.parse(line);
    } catch {
      error = true;
    }

    data.push(object);
  });
  if (error) {
    alert("Could not parse the jsonl.");
    return [];
  }
  return data;
};

/* Main functions */

// Convert a document back to jsonl

const elMap = {
  question: "q",
  answer: "a",
  "question-new": "qn",
  "answer-new": "an",
};

const convertHTMLtoJsonl = (html) => {
  let data = [];
  let tempTexts = [];
  let qaGroup = [];
  let lastEl = "";
  let thisEl = "";
  let seenQ = false;
  let seenA = false;
  html.childNodes.forEach((el, i) => {
    const t = unEsc(el.textContent);

    // Non-annotated text
    if (el.nodeType === 3) {
      /*
      tStrip = t.replace(/^\s+/g, "");
      if (!tStrip) {
        return;
      }
      */
      if (i == 0) {
        if (!t.replace(/^\s+/g, "")) {
          return;
        }
        data = [...data, t];
        return;
      }
      tempTexts.push(t);
      return;
    }

    thisEl = elMap[el.classList[0]];

    // Collect last group
    if ((lastEl != thisEl && seenQ && seenA) || ["qn", "qa"].includes(thisEl)) {
      data = [...data, qaGroup];

      // Push texts after this group
      if (tempTexts) {
        data = [...data, ...tempTexts];
      }

      // Initialize new group and reset
      if (["q", "qn"].includes(thisEl)) {
        qaGroup = [{ q: t }];
      } else {
        qaGroup = [{ a: t }];
      }

      tempTexts = [];
      if (["q", "qn"].includes(thisEl)) {
        seenQ = true;
        seenA = false;
      } else {
        seenA = true;
        seenQ = false;
      }
      return;
    }

    if (tempTexts) {
      for (let tempText of tempTexts) {
        qaGroup.push(tempText);
      }
      tempTexts = [];
    }
    if (thisEl == "q") {
      qaGroup.push({ q: t });
    } else {
      qaGroup.push({ a: t });
    }

    if (thisEl == "q") {
      seenQ = true;
    } else {
      seenA = true;
    }

    lastEl = thisType = el.classList.contains("question") ? "q" : "a";
  });

  // After the loop, collect the rest
  if (qaGroup) {
    data = [...data, qaGroup];
  }
  if (tempTexts) {
    //tempTexts = tempTexts.map((el) => el.replace(/\s+$/g, ""));
    tempTexts = tempTexts.map((el) => el);
    data = [...data, ...tempTexts];
  }
  if (data.slice(-1) == "") {
    data.pop();
  }
  return data;
};

// Update localstorage with a document
const updateJSONL = (el, docId) => {
  const value = !el.childElementCount ? el.innerText : convertHTMLtoJsonl(el);
  const localData = localStorage.getItem("data");

  // Get entire file from localstorage
  const jsonData = jsonlToJson(localData);

  // Update this doc
  jsonData[docId]["text"] = value;

  console.log(jsonData);

  const jsonl = jsonToJsonl(jsonData);

  console.log(jsonl);

  // Update target textarea
  document.querySelector("#target").innerHTML = jsonl;

  // Update localstorage
  localStorage.setItem("data", jsonl);
};

// Convert a doc into HTML
const parseDoc = (doc) => {
  if (typeof doc == "string") {
    return esc(doc);
  }
  return `
    ${doc
      .map((s) => {
        if (typeof s == "string") {
          return esc(s);
        }
        return `${s
          .map((p, i) => {
            let loc = "";
            if (i == 0) {
              loc = "start";
            }
            if (i == s.length - 1) {
              loc = "end";
            }
            if (i == 0 && i == s.length - 1) {
              loc = "start-end";
            }
            if (typeof p == "string") {
              return `${esc(p)}`;
            }
            if ("q" in p) {
              return `<span class="question" data-loc="${loc}">${esc(
                p.q
              )}</span>`;
            } else if ("a" in p) {
              return `<span class="answer" data-loc="${loc}">${esc(
                p.a
              )}</span>`;
            }
          })
          .join("")}`;
      })
      .join("")}
  `;
};

// Refresh a doc
const refreshDoc = (docId) => {
  const data = jsonlToJson(localStorage.getItem("data"));
  console.log(data);
  document.querySelector(`.doc[id="${docId}"]`).innerHTML = parseDoc(
    data[docId].text
  ).replace(/^\s+|\s+$/g, "");
};

// Create the annotator window
const createAnnotator = (data) => {
  document.querySelector("#target").innerHTML = data;
  const json = jsonlToJson(data);

  localStorage.setItem("data", data);

  return `
    ${json
      .map((s, i) => {
        return `<div class="doc" id="${i}">${parseDoc(s.text).replace(/^\s+|\s+$/g, "")}</div>`; // prettier-ignore
      })
      .join("")}
  `;
};

// Flatten (make sure there are no nested Q&A's)
const flattenSpan = (rootSpan) => {
  let allText = "";

  // Traverse through all child nodes and collect their text content
  const collectText = (node) => {
    if (node.nodeType === 3) {
      allText += node.textContent;
    } else if (node.nodeType === 1) {
      Array.from(node.childNodes).forEach((child) => collectText(child));
    }
  };

  collectText(rootSpan);

  // Remove all child nodes
  while (rootSpan.firstChild) {
    rootSpan.removeChild(rootSpan.firstChild);
  }

  // Set the root span's text content to the collected text content
  rootSpan.textContent = allText;
};

// Merge adjacent annotations of the same type
const mergeSameType = (root) => {
  // Cleanup
  root.querySelectorAll("*").forEach((el) => {
    if (el.nodeType === 3 && !/\S/.test(el.textContent)) {
      el.remove;
    }
  });

  // Flatten
  root.querySelectorAll(`:scope > ${qaClasses}`).forEach((el) => {
    flattenSpan(el);
  });

  let matchedArr = Array.from(root.querySelectorAll(qaClasses)); // Select all .matched as array
  let current, next;

  while (matchedArr.length > 0) {
    current = matchedArr.shift();
    next = current.nextSibling;

    while (next) {
      while (next && !/\S/.test(next.textContent)) {
        next = next.nextSibling;
      }
      if (!next) {
        continue;
      }

      if (next.nodeType === 1) {
        if (next.classList[0] == current.classList[0]) {
          current.innerHTML += next.innerHTML;
          next.parentNode.removeChild(next);
          matchedArr.shift();

          next = current.nextSibling;
        }
      }
      break;
    }
  }
};

// Wrap the text with annotation type
const wrap = (cl) => {
  var span = document.createElement("span");
  span.classList.add(cl);

  if (window.getSelection) {
    var sel = window.getSelection();
    const root = sel.anchorNode.parentNode.closest(".doc");
    if (!root) return;
    if (sel.rangeCount) {
      var range = sel.getRangeAt(0).cloneRange();
      try {
        range.surroundContents(span);
      } catch {
        return;
      }

      sel.removeAllRanges();
      sel.addRange(range);
    }

    mergeSameType(root);
    mergeSameType(root); // Must be run twice (bug)
    updateJSONL(root, root.id);
    refreshDoc(root.id);
  }
};

const initAnnotator = () => {
  document.getElementById("annotator").innerHTML = createAnnotator(
    document.querySelector("#origin").value.replace(/^\s+|\s+$/g, "")
  );
};

/* Listeners */

document.addEventListener("DOMContentLoaded", () => {
  // HERE: check if exists in localstorage

  const stored = localStorage.getItem("data");

  if (stored) {
    document.querySelector("#origin").value = stored;
    initAnnotator();
  }

  // Input listeners
  document.addEventListener("input", function (e) {
    if (e.target.matches("#origin")) {
      debounce(initAnnotator)();
    }
  });

  // Input change listener
  document.addEventListener("change", (e) => {
    if (e.target.matches("#upload")) {
      const file = e.target.files[0];
      localStorage.setItem("jsonlfile", JSON.stringify(file));
      const reader = new FileReader();

      reader.addEventListener(
        "load",
        () => {
          // this will then display a text file
          document.querySelector("#origin").value = reader.result;
          initAnnotator();
        },
        false
      );

      if (file) {
        reader.readAsText(file);
      }
    }
  });

  // Click listeners
  document.addEventListener("click", (e) => {
    document.querySelectorAll(qaClasses).forEach((el) => {
      el.classList.remove("selected");
    });
    if (e.target.matches(qaClasses)) {
      e.target.classList.add("selected");
    }

    if (e.target.matches("#download")) {
      const localFile = localStorage.getItem("jsonlfile");
      let fileName;
      if (localFile) {
        fileName =
          JSON.parse(localFile).name.split(".jsonl").shift() +
          "-annotated.jsonl";
      } else {
        fileName = "annotation.jsonl";
      }

      const contents = document.querySelector("#target").innerHTML;
      const file = new File([contents], fileName, {
        type: "text/plain",
      });

      const link = document.createElement("a");
      const url = URL.createObjectURL(file);

      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  });

  // Keyup listeners
  document.addEventListener(
    "keyup",
    (event) => {
      if (event.key == "a") {
        wrap("answer");
      } else if (event.key == "A") {
        wrap("answer-new");
      } else if (event.key == "q") {
        wrap("question");
      } else if (event.key == "Q") {
        wrap("question-new");
      } else if (event.key == "d") {
        let root;
        document.querySelectorAll(".selected").forEach((el) => {
          root = el.closest(".doc");
          el.outerHTML = el.innerHTML;
        });
        if (root) {
          updateJSONL(root, root.id);
        }
      }
    },
    false
  );
});
