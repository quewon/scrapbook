var selectedEphemera = [];
var draggingEphemera;
var textCreationDisabled = false;
var shiftKeyDown = false;

var imageUpload = document.getElementById("imageupload");
var mousePosition = { x:-1, y:-1 };

function init() {
  document.addEventListener("mousemove", function(e) {
    mousePosition = { x: e.pageX, y: e.pageY };

    if (draggingEphemera) {
      draggingEphemera.move(mousePosition.x, mousePosition.y);
    }
  });

  document.addEventListener("mousedown", function(e) {

  });

  document.addEventListener("mouseup", function(e) {
    for (let i=selectedEphemera.length-1; i>=0; i--) {
      selectedEphemera[i].deselect(i>0);
    }

    if (draggingEphemera) draggingEphemera.drop();
  });

  document.addEventListener("blur", function(e) {
    if (draggingEphemera) draggingEphemera.drop();
  });

  imageUpload.addEventListener("change", function(e) {
    for (let image of imageUpload.files) {
      importImage(scrapbook, image);
    }
  });

  document.addEventListener("dragover", function(e) {
    // console.log("file(s) in drop zone");

    e.preventDefault();
  });

  document.addEventListener("drop", function(e) {
    e.preventDefault();

    if (e.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      [...e.dataTransfer.items].forEach((item, i) => {
        // If dropped items aren't files, reject them
        if (item.kind === "file") {
          const file = item.getAsFile();
          console.log("file name = "+file.name);
          importImage(scrapbook, file);
        }
      });
    } else {
      // Use DataTransfer interface to access the file(s)
      [...e.dataTransfer.files].forEach((file, i) => {
        console.log("file name = "+file.name);
        importImage(scrapbook, file);
      });
    }
  });

  document.addEventListener("keyup", function(e) {
    shiftKeyDown = e.shiftKey;

    switch (e.key) {
      case "Backspace":
        for (let i=selectedEphemera.length-1; i>=0; i--) {
          const ephemera = selectedEphemera[i];
          if (!ephemera.focused) {
            ephemera.delete(i > 0);
          }
        }
        break;

      case "Escape":
        if (draggingEphemera) draggingEphemera.drop();
        for (let i=selectedEphemera.length-1; i>=0; i--) {
          selectedEphemera[i].deselect(i > 0);
        }
        break;
    }

    if (e.key == "ArrowUp" || e.key == "ArrowDown" || e.key == "ArrowLeft" || e.key == "ArrowRight") {
      e.preventDefault();
      scrapbook.step();
    }
  });

  document.addEventListener("keydown", function(e) {
    shiftKeyDown = e.shiftKey;

    if ((e.ctrlKey || e.metaKey) && e.key == "z") {
      e.preventDefault();
      if (shiftKeyDown) {
        scrapbook.redo();
      } else {
        scrapbook.undo();
      }
    }

    if (selectedEphemera.length > 0) {
      if (e.key == "ArrowUp" || e.key == "ArrowDown" || e.key == "ArrowLeft" || e.key == "ArrowRight") {
        e.preventDefault();

        let x = 0;
        let y = 0;

        switch (e.key) {
          case "ArrowUp":
            y = -1;
            break;

          case "ArrowDown":
            y = 1;
            break;

          case "ArrowLeft":
            x = -1;
            break;

          case "ArrowRight":
            x = 1;
            break;
        }

        for (let ephemera of selectedEphemera) {
          if (ephemera.focused) continue;
          ephemera.move(ephemera.position.x + x, ephemera.position.y + y, null, i > 0);
        }
      }
    }
  });

  document.addEventListener("keypress", function(e) {
    if (!textCreationDisabled && e.key) {
      e.preventDefault();
      var ephemera = createText(scrapbook);
    }
  });
}

function toDataUrl(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
      var reader = new FileReader();
      reader.onloadend = function() {
          callback(reader.result);
      }
      reader.readAsDataURL(xhr.response);
  };
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.send();
}

class Scrapbook {
  constructor() {
    this.ephemera = [];
    this.history = [];
    this.historyIndex = -1;

    this.domElement = document.createElement("div");
    this.domElement.className = "scrapbook";

    document.body.appendChild(this.domElement);
  }

  add(ephemera, dontStep) {
    ephemera.index = this.ephemera.length;
    ephemera.domElement.dataset.index = ephemera.index;
    ephemera.scrapbook = this;
    this.ephemera.push(ephemera);
    this.domElement.appendChild(ephemera.domElement);

    if (!dontStep) this.step();
  }

  undo() {
    if (this.historyIndex <= 0) {
      console.log("no more undos");
      return;
    }

    this.historyIndex--;
    this.pasteSnapshot(this.history[this.historyIndex]);

    this.workspaceSnapshot = this.createSnapshot();
    this.pasteSnapshot(this.workspaceSnapshot);
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) {
      console.trace("no more redos");
      return;
    }

    this.historyIndex++;
    this.pasteSnapshot(this.history[this.historyIndex]);

    this.workspaceSnapshot = this.createSnapshot();
    this.pasteSnapshot(this.workspaceSnapshot);
  }

  pasteSnapshot(snapshot) {
    for (let i=this.ephemera.length-1; i>=0; i--) {
      this.ephemera[i].delete(true);
    }

    snapshot = JSON.parse(snapshot).data;

    for (let ephemera of snapshot) {
      var temp;
      var width, height;

      switch (ephemera.type) {
        case "image":
          temp = new ImageElement(ephemera.imageSrc);
          break;

        case "text":
          temp = new TextElement(ephemera.text);
          break;
      }

      if (ephemera.size) temp.setSize(ephemera.size.width, ephemera.size.height);
      if (ephemera.position) temp.move(ephemera.position.x, ephemera.position.y);
      temp.mousedown = ephemera.mousedown;

      this.add(temp, true);

      if (ephemera.selected) {
        temp.select(false, true);
      } else {
        temp.deselect(true);
      }
    }
  }

  createSnapshot() {
    var snapshot = [];

    for (let ephemera of this.ephemera) {
      ephemera.domOrder = Array.prototype.indexOf.call(this.domElement.children, ephemera.domElement);
    }

    for (let ephemera of this.ephemera) {
      snapshot[ephemera.domOrder] = {
        type: ephemera.type,
        text: ephemera.type == "text" ? ephemera.textarea.innerHTML : null,
        imageSrc: ephemera.imageSrc,
        position: ephemera.position,
        size: ephemera.size,
        mousedown: ephemera.mousedown,
        selected: ephemera.selected
      };
    }

    return JSON.stringify({ data: snapshot });
  }

  clearHistory() {
    console.clear();

    this.history = [];
    this.step();

    this.workspaceSnapshot = this.createSnapshot();
    this.pasteSnapshot(this.workspaceSnapshot);
  }

  step() {
    this.history.splice(this.historyIndex + 1);

    this.history.push(this.createSnapshot());
    this.historyIndex = this.history.length - 1;

    console.trace("step");
  }
}

class Ephemera {
  constructor() {
    this.scrapbook = null;
    this.selected = false;
    this.dragging = false;
    this.mousedown = false;

    this.domElement = document.createElement("div");
    this.domElement.className = "ephemera";

    this.domElement.addEventListener("mouseup", function(e) {
      const ephemera = scrapbook.ephemera[this.dataset.index];
      if (ephemera.mousedown) {
        if (shiftKeyDown) {
          ephemera.select(null, null, true);
        } else {
          ephemera.select();
        }
      } else if (ephemera.dragging) {
        ephemera.drop(null, true);
      }

      e.stopPropagation();
    });

    this.domElement.addEventListener("mousedown", function(e) {
      const ephemera = scrapbook.ephemera[this.dataset.index];

      ephemera.mousedown = true;
      ephemera.mousedownPosition = { x: mousePosition.x, y: mousePosition.y };

      if (!ephemera.focused) {
        ephemera.drag(mousePosition.x, mousePosition.y);
      }

      e.stopPropagation();
    });
  }

  move(x, y, stopPropagation) {
    const ox = this.position ? this.position.x : 0;
    const oy = this.position ? this.position.y : 0;

    this.position = {
      x: x + (this.dragOffset ? this.dragOffset.x : 0),
      y: y + (this.dragOffset ? this.dragOffset.y : 0)
    }

    const dx = ox - this.position.x;
    const dy = oy - this.position.y;

    if (!stopPropagation) {
      for (let ephemera of selectedEphemera) {
        if (ephemera == this) continue;
        ephemera.move(ephemera.position.x - dx, ephemera.position.y - dy, true);
      }
    }

    this.domElement.style.left = this.position.x+"px";
    this.domElement.style.top = this.position.y+"px";

    if (this.mousedownPosition) {
      const a = mousePosition.x - this.mousedownPosition.x;
      const b = mousePosition.y - this.mousedownPosition.y;
      const sqrMagnitude = a * a + b * b;
      if (sqrMagnitude > .8) {
        this.mousedown = false;
      }
    }
  }

  drag(x, y) {
    if (!shiftKeyDown && !this.selected) {
      for (let i=selectedEphemera.length-1; i>=0; i--) {
        const ephemera = selectedEphemera[i];
        if (ephemera == this) continue;
        ephemera.deselect(i > 0);
      }
    }

    this.domElement.classList.add("dragging");

    const rect = this.domElement.getBoundingClientRect();
    this.dragOffset = {
      x: (document.documentElement.scrollLeft || 0) + rect.left - x,
      y: (document.documentElement.scrollTop || 0) + rect.top - y };

    document.body.classList.add("dragging");
    draggingEphemera = this;
    this.dragging = true;

    this.scrapbook.domElement.appendChild(this.domElement);
  }

  drop(dontStep, plusSelect) {
    this.domElement.classList.remove("dragging");
    document.body.classList.remove("dragging");
    draggingEphemera = null;
    this.dragging = false;
    this.mousedown = false;
    this.dragOffset = { x:0, y:0 };

    if (!plusSelect) {
      for (let i=selectedEphemera.length-1; i>=0; i--) {
        if (selectedEphemera[i] == this) continue;
        selectedEphemera[i].deselect(i > 0);
      }
    }

    if (!dontStep && this.scrapbook) this.scrapbook.step();
  }

  select(autoFocus, dontStep, plusSelect) {
    if (this.selected) {
      this.focus();
      this.drop(true);
    } else {
      selectedEphemera.push(this);
      this.domElement.classList.add("selected");
      this.selected = true;
      if (autoFocus) this.focus();
      this.drop(dontStep, plusSelect);

      if (plusSelect) {
        for (let ephemera of selectedEphemera) {
          if (ephemera.focused) {
            ephemera.unfocus(true);
          }
        }
        if (selectedEphemera.length > 0) scrapbook.step();
      }
    }
  }

  deselect(dontStep) {
    this.unfocus(dontStep);
    this.domElement.classList.remove("selected");
    this.selected = false;
    this.mousedown = false;
    selectedEphemera.splice(selectedEphemera.indexOf(this), 1);
  }

  focus(dontStep) {
    this.domElement.classList.add("focused");
    this.focused = true;
    this.focusAction(dontStep);
  }
  unfocus(dontStep) {
    this.domElement.classList.remove("focused");
    this.focused = false;
    this.unfocusAction(dontStep);
  }

  focusAction(dontStep) { }
  unfocusAction(dontStep) { }

  delete(dontStep) {
    this.domElement.remove();
    this.scrapbook.ephemera.splice(this.index, 1);
    for (let i=this.index; i<this.scrapbook.ephemera.length; i++) {
      const ephemera = this.scrapbook.ephemera[i]
      ephemera.index--;
      ephemera.domElement.dataset.index = ephemera.index;
    }

    let id = selectedEphemera.indexOf(this);
    if (id != -1) selectedEphemera.splice(id, 1);

    if (!dontStep) this.scrapbook.step();
  }
}

class TextElement extends Ephemera {
  constructor(input) {
    super();

    this.type = "text";

    const textarea = document.createElement("div");
    textarea.setAttribute("contenteditable", true);

    this.domElement.appendChild(textarea);
    this.textarea = textarea;

    if (input) {
      this.textarea.innerHTML = input;
    }
  }

  focusAction(dontStep) {
    textCreationDisabled = true;
    this.textarea.focus();

    this.initialText = this.textarea.textContent;

    try {
      var range = document.createRange();
      var sel = window.getSelection();

      range.setStart(this.textarea, this.textarea.textContent.length);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    catch {

    }
  }

  unfocusAction(dontStep) {
    textCreationDisabled = false;
    this.textarea.blur();
    if (this.textarea.textContent.trim() == "") {
      this.delete();
    }

    if (this.initialText && this.textarea.textContent != this.initialText) {
      this.initialText = null;
      if (!dontStep) this.scrapbook.step();
    }
  }

  setSize(width, height) {
    this.size = { width: width, height: height };

    this.textarea.style.width = width+"px";
    this.textarea.style.height = height+"px";

    if (this.scrapbook) this.scrapbook.step();
  }
}

class ImageElement extends Ephemera {
  constructor(imageSrc) {
    super();

    this.type = "image";

    const image = document.createElement("img");
    image.src = imageSrc;

    const div = document.createElement("div");
    div.appendChild(image);
    div.className = "image";

    this.domElement.appendChild(div);
    this.image = div;
    this.imageSrc = imageSrc;
  }

  focusAction(dontStep) {

  }

  unfocusAction(dontStep) {

  }

  setSize(width, height) {
    this.size = { width: width, height: height };

    this.image.style.width = width+"px";
    this.image.style.height = height+"px";

    if (this.scrapbook) this.scrapbook.step();
  }
}

function importImage(scrapbook, image) {
  const src = URL.createObjectURL(image);
  const ephemera = new ImageElement(src);
  scrapbook.add(ephemera);

  ephemera.move(mousePosition.x, mousePosition.y);
}

function createText(scrapbook, input) {
  const ephemera = new TextElement(input);
  scrapbook.add(ephemera);
  ephemera.select(true);

  ephemera.move(mousePosition.x, mousePosition.y);

  return ephemera;
}
