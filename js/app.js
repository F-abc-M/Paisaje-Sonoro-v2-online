async function setup() {
    const patchExportURL = "export/patch.export.json";

    // Create AudioContext
    const WAContext = window.AudioContext || window.webkitAudioContext;
    const context = new WAContext();

    // Create gain node and connect it to audio output
    const outputNode = context.createGain();
    outputNode.connect(context.destination);

    // Fetch the exported patcher
    let response, patcher;
    try {
        response = await fetch(patchExportURL);
        patcher = await response.json();

        if (!window.RNBO) {
            // Load RNBO script dynamically
            // Note that you can skip this by knowing the RNBO version of your patch
            // beforehand and just include it using a <script> tag
            await loadRNBOScript(patcher.desc.meta.rnboversion);
        }

    } catch (err) {
        const errorContext = {
            error: err
        };
        if (response && (response.status >= 300 || response.status < 200)) {
            errorContext.header = `Couldn't load patcher export bundle`,
            errorContext.description = `Check app.js to see what file it's trying to load. Currently it's` +
            ` trying to load "${patchExportURL}". If that doesn't` + 
            ` match the name of the file you exported from RNBO, modify` + 
            ` patchExportURL in app.js.`;
        }
        if (typeof guardrails === "function") {
            guardrails(errorContext);
        } else {
            throw err;
        }
        return;
    }

    // (Optional) Fetch the dependencies
    let dependencies = [];
    try {
        const dependenciesResponse = await fetch("export/dependencies.json");
        dependencies = await dependenciesResponse.json();

        // Prepend "export" to any file dependenciies
        dependencies = dependencies.map(d => d.file ? Object.assign({}, d, { file: "export/" + d.file }) : d);
    } catch (e) {}

    // Create the device
    let device;
    try {
        device = await RNBO.createDevice({ context, patcher });
    } catch (err) {
        if (typeof guardrails === "function") {
            guardrails({ error: err });
        } else {
            throw err;
        }
        return;
    }

    // (Optional) Load the samples
    if (dependencies.length)
        await device.loadDataBufferDependencies(dependencies);

    // Connect the device to the web audio graph
    device.node.connect(outputNode);

    // (Optional) Extract the name and rnbo version of the patcher from the description
    // document.getElementById("patcher-title").innerText = (patcher.desc.meta.filename || "Unnamed Patcher") + " (v" + patcher.desc.meta.rnboversion + ")";

    // (Optional) Automatically create sliders for the device parameters
    makeSliders(device);

    // (Optional) Load presets, if any
    loadPresets(device, patcher);

    document.body.onclick = () => {
        context.resume();
    }

    // Skip if you're not using guardrails.js
    if (typeof guardrails === "function")
        guardrails();
}

function loadRNBOScript(version) {
    return new Promise((resolve, reject) => {
        if (/^\d+\.\d+\.\d+-dev$/.test(version)) {
            throw new Error("Patcher exported with a Debug Version!\nPlease specify the correct RNBO version to use in the code.");
        }
        const el = document.createElement("script");
        el.src = "https://c74-public.nyc3.digitaloceanspaces.com/rnbo/" + encodeURIComponent(version) + "/rnbo.min.js";
        el.onload = resolve;
        el.onerror = function(err) {
            console.log(err);
            reject(new Error("Failed to load rnbo.js v" + version));
        };
        document.body.append(el);
    });
}

function makeSliders(device) {
    let pdiv = document.getElementById("rnbo-parameter-sliders");
    let noParamLabel = document.getElementById("no-param-label");
    if (noParamLabel && device.numParameters > 0) pdiv.removeChild(noParamLabel);

    // This will allow us to ignore parameter update events while dragging the slider.
    let isDraggingSlider = false;
    let uiElements = {};

    device.parameters.forEach(param => {
        // Subpatchers also have params. If we want to expose top-level
        // params only, the best way to determine if a parameter is top level
        // or not is to exclude parameters with a '/' in them.
        // You can uncomment the following line if you don't want to include subpatcher params

        //if (param.id.includes("/")) return;

        // Create a label, an input slider and a value display
        let label = document.createElement("label");
        let slider = document.createElement("input");
        let text = document.createElement("input");
        let sliderContainer = document.createElement("div");
        // sliderContainer.appendChild(label);
        sliderContainer.appendChild(slider);
        // sliderContainer.appendChild(text);

        // Add a name for the label
        label.setAttribute("name", param.name);
        label.setAttribute("for", param.name);
        label.setAttribute("class", "param-label");
        label.textContent = `${param.name}: `;

        // Make each slider reflect its parameter
        slider.setAttribute("type", "range");
        slider.setAttribute("class", "param-slider");
        slider.setAttribute("id", param.id);
        slider.setAttribute("name", param.name);
        slider.setAttribute("min", param.min);
        slider.setAttribute("max", param.max);

        // the rotate animation
        slider.addEventListener('pointerdown', () => {
            if (slider.id.includes('play') || slider.id.includes('stop')) {
                slider.classList.add('rotate');
                setTimeout(() => {
                    slider.classList.remove('rotate');
                }, 12500)
            }
        })

        if (param.steps > 1) {
            slider.setAttribute("step", (param.max - param.min) / (param.steps - 1));
        } else {
            slider.setAttribute("step", (param.max - param.min) / 1000.0);
        }
        slider.setAttribute("value", param.value);

        // Make a settable text input display for the value
        text.setAttribute("value", param.value.toFixed(3));
        text.setAttribute("type", "text");

        // Make each slider control its parameter
        slider.addEventListener("pointerdown", () => {
            isDraggingSlider = true;
        });
        slider.addEventListener("pointerup", () => {
            isDraggingSlider = false;
            slider.value = param.value;
            text.value = param.value.toFixed(3);
            if (slider.id.includes('ondacampaon') && slider.value == 2) {
                slider.classList.add('ondaoncampana');
            } else if (slider.id.includes('ondacampaon') && slider.value != 2) {
                slider.classList.remove('ondaoncampana');
            } else if (slider.id.includes('ondasemaon') && slider.value == 2) {
                slider.classList.add('ondasemaforo');
            } else if (slider.id.includes('ondasemaon') && slider.value != 2) {
                slider.classList.remove('ondasemaforo');
            } else if (slider.id.includes('ondaambuon') && slider.value == 2) {
                slider.classList.add('ondaambulancia');
            } else if (slider.id.includes('ondaambuon') && slider.value != 2) {
                slider.classList.remove('ondaambulancia');
            } else if (slider.id.includes('ondatrenon') && slider.value == 2) {
                slider.classList.add('ondatren');
            } else if (slider.id.includes('ondatrenon') && slider.value != 2) {
                slider.classList.remove('ondatren');
            } else if (slider.id.includes('ondavion') && slider.value == 2) {
                slider.classList.add('ondaavion');
            } else if (slider.id.includes('ondavion') && slider.value != 2) {
                slider.classList.remove('ondaavion');
            }
        });

        slider.addEventListener("input", () => {
            let value = Number.parseFloat(slider.value);
            param.value = value;
        });

        // Make the text box input control the parameter value as well
        text.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                let newValue = Number.parseFloat(text.value);
                if (isNaN(newValue)) {
                    text.value = param.value;
                } else {
                    newValue = Math.min(newValue, param.max);
                    newValue = Math.max(newValue, param.min);
                    text.value = newValue;
                    param.value = newValue;
                }
            }
        });

        // the backgroud for noise
        slider.addEventListener('pointerup', () => {
            let theBackgroundForNoise = document.getElementById('bg');
            if (slider.id.includes('gainnoise') && slider.value > 0.01 ) {
                theBackgroundForNoise.classList.add('visualNoise');
            } else if (slider.id.includes('gainnoise') && slider.value <= 0.01) {
                theBackgroundForNoise.classList.remove('visualNoise');
            }
        })

        // the backgroud for paisaje
        slider.addEventListener('pointerup', () => {
            let theBackgroundForPaisaje = document.getElementById('agua');
            if (slider.id.includes('gainwave') && slider.value > 0.01 ) {
                theBackgroundForPaisaje.classList.add('agua');
            } else if (slider.id.includes('gainwave') && slider.value <= 0.01) {
                theBackgroundForPaisaje.classList.remove('agua');
            }
        })

        // the backgroud for gran
        slider.addEventListener('pointerup', () => {
            let theBackgroundForGran = document.getElementById('bgran');
            if (slider.id.includes('gaingran') && slider.value > 0.01 ) {
                theBackgroundForGran.classList.add('visualGran');
            } else if (slider.id.includes('gaingran') && slider.value <= 0.01) {
                theBackgroundForGran.classList.remove('visualGran');
            }
        })

        // Store the slider and text by name so we can access them later
        uiElements[param.id] = { slider, text };

        // Add the slider element
        pdiv.appendChild(sliderContainer);
    });

    // Listen to parameter changes from the device
    device.parameterChangeEvent.subscribe(param => {
        if (!isDraggingSlider)
            uiElements[param.id].slider.value = param.value;
        uiElements[param.id].text.value = param.value.toFixed(3);
    });
}

function loadPresets(device, patcher) {
    let presets = patcher.presets || [];
    if (presets.length < 1) {
        document.getElementById("rnbo-presets").removeChild(document.getElementById("preset-select"));
        return;
    }

    document.getElementById("rnbo-presets").removeChild(document.getElementById("no-presets-label"));
    let presetSelect = document.getElementById("preset-select");
    presets.forEach((preset, index) => {
        const option = document.createElement("option");
        option.innerText = "Sound On"; // CAMBIAR NOMBRE A TRIGGER
        option.value = index;
        presetSelect.appendChild(option);
    });
    presetSelect.onchange = () => device.setPreset(presets[presetSelect.value].preset);
}

setup();