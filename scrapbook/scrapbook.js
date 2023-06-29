var selectedEphemera;
var draggingEphemera;

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
    if (draggingEphemera) draggingEphemera.drop();

    if (selectedEphemera) {
      if (selectedEphemera.mousedown) {
        selectedEphemera.mousedown = false;
      } else {
        selectedEphemera.deselect();
      }
    }
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
    switch (e.key) {
      case "Backspace":
        if (selectedEphemera && !selectedEphemera.focused) {
          selectedEphemera.delete();
        }
        break;
    }
  });

  document.addEventListener("keydown", function(e) {
    if (selectedEphemera && !selectedEphemera.focused) {
      if (e.key == "ArrowUp" || e.key == "ArrowDown" || e.key == "ArrowLeft" || e.key == "ArrowRight") {
        e.preventDefault();

        switch (e.key) {
          case "ArrowUp":
            selectedEphemera.move(selectedEphemera.position.x, selectedEphemera.position.y - 1);
            break;

          case "ArrowDown":
            selectedEphemera.move(selectedEphemera.position.x, selectedEphemera.position.y + 1);
            break;

          case "ArrowLeft":
            selectedEphemera.move(selectedEphemera.position.x - 1, selectedEphemera.position.y);
            break;

          case "ArrowRight":
            selectedEphemera.move(selectedEphemera.position.x + 1, selectedEphemera.position.y);
            break;
        }
      }
    }
  });

  document.addEventListener("keypress", function(e) {
    if (!selectedEphemera && e.key) {
      e.preventDefault();
      createText(scrapbook);
    }
  });
}

class Scrapbook {
  constructor() {
    this.ephemera = [];
    this.domElement = document.createElement("div");
    this.domElement.className = "scrapbook";

    document.body.appendChild(this.domElement);
  }

  add(ephemera) {
    ephemera.index = this.ephemera.length;
    ephemera.domElement.dataset.index = ephemera.index;
    ephemera.scrapbook = this;
    this.ephemera.push(ephemera);
    this.domElement.appendChild(ephemera.domElement);
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
        ephemera.select();
      } else if (ephemera.dragging) {
        ephemera.drop();
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

  move(x, y) {
    this.position = {
      x: x + (this.dragOffset ? this.dragOffset.x : 0),
      y: y + (this.dragOffset ? this.dragOffset.y : 0)
    }

    this.domElement.style.left = this.position.x+"px";
    this.domElement.style.top = this.position.y+"px";

    if (this.mousedownPosition) {
      const a = mousePosition.x - this.mousedownPosition.x;
      const b = mousePosition.y - this.mousedownPosition.y;
      const sqrMagnitude = a * a + b * b;
      if (sqrMagnitude > 1) {
        this.mousedown = false;
      }
    }
  }

  drag(x, y) {
    this.domElement.classList.add("dragging");

    const rect = this.domElement.getBoundingClientRect();
    this.dragOffset = { x: rect.left - x, y: rect.top - y };

    document.body.classList.add("dragging");
    draggingEphemera = this;
    this.dragging = true;

    this.scrapbook.domElement.appendChild(this.domElement);
  }

  drop() {
    this.domElement.classList.remove("dragging");
    document.body.classList.remove("dragging");
    draggingEphemera = null;
    this.dragging = false;
    this.mousedown = false;
    this.dragOffset = { x:0, y:0 };

    if (selectedEphemera && selectedEphemera != this) selectedEphemera.deselect();
  }

  select(autoFocus) {
    if (this.selected) {
      this.focus();
    } else {
      if (selectedEphemera) selectedEphemera.deselect();
      selectedEphemera = this;
      this.domElement.classList.add("selected");
      this.selected = true;
      if (autoFocus) this.focus();
    }

    this.drop();
  }

  deselect() {
    this.unfocus();
    this.domElement.classList.remove("selected");
    selectedEphemera = null;
    this.selected = false;
    this.mousedown = false;
  }

  focus() {
    this.domElement.classList.add("focused");
    this.focused = true;
    this.focusAction();
  }
  unfocus() {
    this.domElement.classList.remove("focused");
    this.focused = false;
    this.unfocusAction();
  }

  focusAction() { }
  unfocusAction() { }

  delete() {
    this.domElement.remove();
    this.scrapbook.ephemera.splice(this.index, 1);
    for (let i=this.index; i<this.scrapbook.ephemera.length; i++) {
      const ephemera = this.scrapbook.ephemera[i]
      ephemera.index--;
      ephemera.domElement.dataset.index = ephemera.index;
    }
  }
}

class TextElement extends Ephemera {
  constructor() {
    super();

    const textarea = document.createElement("div");
    textarea.setAttribute("contenteditable", true);

    this.domElement.appendChild(textarea);
    this.textarea = textarea;
  }

  focusAction() {
    this.textarea.focus();
  }

  unfocusAction() {
    this.textarea.blur();
    if (this.textarea.textContent.trim() == "") {
      this.delete();
    }
  }

  setText(text) {
    this.textarea.innerHTML = text;
  }

  setSize(width, height) {
    this.textarea.style.width = width+"px";
    this.textarea.style.height = height+"px";
  }
}

class ImageElement extends Ephemera {
  constructor(imageSrc) {
    super();

    const image = document.createElement("img");
    image.src = imageSrc;

    const div = document.createElement("div");
    div.appendChild(image);
    div.className = "image";

    this.domElement.appendChild(div);
    this.image = div;
  }

  focusAction() {

  }

  unfocusAction() {

  }
}

function importImage(scrapbook, image) {
  const src = URL.createObjectURL(image);
  const ephemera = new ImageElement(src);
  scrapbook.add(ephemera);

  ephemera.move(mousePosition.x, mousePosition.y);
}

function createText(scrapbook) {
  const ephemera = new TextElement();
  scrapbook.add(ephemera);
  ephemera.select(true);

  ephemera.move(mousePosition.x, mousePosition.y);
}
