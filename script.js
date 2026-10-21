const storageKeys = {
    revisionTasks: "studentPlannerRevisionTasks",
    savedMarks: "studentPlannerSavedMarks",
    goalMark: "studentPlannerGoalMark"
};

const plannerState = {
    assessments: [],
    revisionTasks: loadSavedData(storageKeys.revisionTasks, []),
    savedMarks: loadSavedData(storageKeys.savedMarks, {}),
    goalMark: loadSavedData(storageKeys.goalMark, 60),
    timer: {
        duration: 25 * 60,
        remaining: 25 * 60,
        running: false,
        paused: false,
        intervalId: null
    }
};

const goalSelect = document.getElementById("goal-select");
const taskForm = document.getElementById("task-form");
const taskMessage = document.getElementById("task-message");
const taskList = document.getElementById("task-list");
const alertList = document.getElementById("alert-list");
const calendarList = document.getElementById("calendar-list");
const markList = document.getElementById("mark-list");
const markMessage = document.getElementById("mark-message");
const goalSummary = document.getElementById("goal-summary");
const goalProgressFill = document.getElementById("goal-progress-fill");
const focusToggleButton = document.getElementById("focusToggleBtn");
const focusResetButton = document.getElementById("focusResetBtn");
const timerDisplay = document.getElementById("timerDisplay");
const timerLabel = document.getElementById("timerLabel");
const timerSlider = document.getElementById("timerMinutes");
const timerValue = document.getElementById("timerVal");
const timerStartButton = document.getElementById("timerStart");
const modalOverlay = document.getElementById("modalOverlay");
const modalCloseButton = document.getElementById("modalClose");
const ringProgress = document.getElementById("ringProgress");

document.addEventListener("DOMContentLoaded", startApp);

// 
async function startApp() {
    setTodayAsMinDate();
    goalSelect.value = String(plannerState.goalMark);
    attachEventListeners();
    initializeTimer();

    try {
        const response = await fetch("assessments.json");
        plannerState.assessments = await response.json();
        renderEverything();
    } catch (error) {
        alertList.innerHTML = '<div class="empty-state">Could not load the JSON file.</div>';
        calendarList.innerHTML = '<div class="empty-state">Assessment calendar could not be loaded.</div>';
        markList.innerHTML = '<div class="empty-state">Assessment marks could not be loaded.</div>';
    }
}


// Listeners for clicks from the user to be able to handle various tasks
function attachEventListeners() {
    taskForm.addEventListener("submit", handleTaskSubmit);
    goalSelect.addEventListener("change", handleGoalChange);
    focusToggleButton.addEventListener("click", handleTimerButtonClick);
    focusResetButton.addEventListener("click", resetTimer);
    timerSlider.addEventListener("input", handleTimerLengthChange);
    timerStartButton.addEventListener("click", startTimerFromModal);
    modalCloseButton.addEventListener("click", closeTimerModal);
    modalOverlay.addEventListener("click", (event) => {
        if (event.target === modalOverlay) {
            closeTimerModal();
        }
    });
}


// Renders all major components of the application interface, including alerts and calendar. Also revision tasks, marks, goal progress.
// Function also renders update functions
function renderEverything() {
    renderAlerts();
    renderCalendars();
    renderRevisionTasks();
    renderAssessmentMarks();
    updateGoalProgress();
}

// Creating alerts for deadlines and revisiion tasks
function renderAlerts() {
    const alertItems = [];
    const today = startOfDay(new Date());
    const nextThirtyDays = addDays(today, 30);

    plannerState.assessments.forEach((assessment) => {
        const assessmentDate = parseLocalDate(assessment.deadline);

        if (assessmentDate >= today && assessmentDate <= nextThirtyDays) {
            alertItems.push({
                title: assessment.assessmentName,
                subtitle: assessment.module,
                deadlineText: formatDate(assessment.deadline),
                style: "upcoming",
                details: `${assessment.type} deadline`,
                sortDate: assessment.deadline
            });
        }
    });

    plannerState.revisionTasks.forEach((task) => {
        const taskDate = parseLocalDate(task.dueDate);

        if (!task.completedDate && taskDate < today) {
            alertItems.push({
                title: task.description,
                subtitle: "Revision task",
                deadlineText: formatDate(task.dueDate),
                style: "overdue",
                details: "Task is overdue",
                sortDate: task.dueDate
            });
        } else if (taskDate >= today && taskDate <= nextThirtyDays) {
            alertItems.push({
                title: task.description,
                subtitle: "Revision task",
                deadlineText: formatDate(task.dueDate),
                style: "upcoming",
                details: "Task due soon",
                sortDate: task.dueDate
            });
        }
    });

    alertItems.sort((firstItem, secondItem) => {
        return parseLocalDate(firstItem.sortDate) - parseLocalDate(secondItem.sortDate);
    });

    if (alertItems.length === 0) {
        alertList.innerHTML = '<div class="empty-state">No overdue or upcoming items in the next 30 days.</div>';
        return;
    }

    alertList.innerHTML = alertItems.map((item) => {
        const statusClass = item.style === "overdue" ? "overdue" : "pending";

        return `
            <article class="alert-card ${item.style}">
                <div class="task-top">
                    <div>
                        <h3>${escapeHtml(item.title)}</h3>
                        <p class="task-meta">${escapeHtml(item.subtitle)}</p>
                    </div>
                    <span class="status-pill ${statusClass}">${item.details}</span>
                </div>
                <p class="task-meta">Date: ${item.deadlineText}</p>
            </article>
        `;
    }).join("");
}

// CALENDAR FEATURE

function renderCalendars() {
    const groupedByMonth = {};
    const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let currentDisplayMonth = new Date();

    plannerState.assessments.forEach((assessment) => {
        const assessmentDate = parseLocalDate(assessment.deadline);
        const monthKey = `${assessmentDate.getFullYear()}-${assessmentDate.getMonth()}`;

        if (!groupedByMonth[monthKey]) {
            groupedByMonth[monthKey] = [];
        }

        groupedByMonth[monthKey].push(assessment);
    });

    function renderCalendarMonth(displayDate) {
        const yearNumber = displayDate.getFullYear();
        const monthNumber = displayDate.getMonth();
        const monthKey = `${yearNumber}-${monthNumber}`;
        const monthDate = new Date(yearNumber, monthNumber, 1);
        const firstDayPosition = (monthDate.getDay() + 6) % 7;
        const daysInMonth = new Date(yearNumber, monthNumber + 1, 0).getDate();
        const daysInPrevMonth = new Date(yearNumber, monthNumber, 0).getDate();
        const assessmentsInMonth = groupedByMonth[monthKey] || [];
        const dayCells = [];

        weekdayNames.forEach((name) => {
            dayCells.push(`<div class="day-name">${name}</div>`);
        });

        for (let blankDay = firstDayPosition - 1; blankDay >= 0; blankDay -= 1) {
            const dayNumber = daysInPrevMonth - blankDay;
            dayCells.push(`<div class="calendar-day empty"><span class="day-number">${dayNumber}</span></div>`);
        }

        for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
            const matchingAssessments = assessmentsInMonth.filter((assessment) => {
                return parseLocalDate(assessment.deadline).getDate() === dayNumber;
            });

            const deadlineMarkup = matchingAssessments.map((assessment) => {
                return `<span class="deadline-chip ${assessment.type}">${escapeHtml(assessment.assessmentName)}</span>`;
            }).join("");

            dayCells.push(`
                <div class="calendar-day ${matchingAssessments.length > 0 ? "has-deadline" : ""}">
                    <span class="day-number">${dayNumber}</span>
                    ${deadlineMarkup}
                </div>
            `);
        }

        return `
            <section class="calendar-month">
                <h3>${monthDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h3>
                <div class="calendar-grid">
                    ${dayCells.join("")}
                </div>
            </section>
        `;
    }

    function attachNavigationListeners() {
        document.getElementById("prev-month-btn").addEventListener("click", () => {
            currentDisplayMonth.setMonth(currentDisplayMonth.getMonth() - 1);
            calendarList.innerHTML = monthNavigation + renderCalendarMonth(currentDisplayMonth);
            attachNavigationListeners();
        });

        document.getElementById("next-month-btn").addEventListener("click", () => {
            currentDisplayMonth.setMonth(currentDisplayMonth.getMonth() + 1);
            calendarList.innerHTML = monthNavigation + renderCalendarMonth(currentDisplayMonth);
            attachNavigationListeners();
        });
    }

    const monthNavigation = `
        <div class="calendar-navigation">
            <button id="prev-month-btn" class="month-nav-btn">← Previous</button>
            <button id="next-month-btn" class="month-nav-btn">Next →</button>
        </div>
    `;

    calendarList.innerHTML = monthNavigation + renderCalendarMonth(currentDisplayMonth);
    attachNavigationListeners();
}



// Handles the submission of a new revision task validating inputs and adding it to the planner 
function handleTaskSubmit(event) {
    event.preventDefault();
    taskMessage.textContent = "";

    const taskTextInput = document.getElementById("task-text");
    const taskLinkInput = document.getElementById("task-link");
    const taskDueDateInput = document.getElementById("task-due-date");

    const description = taskTextInput.value.trim();
    const link = taskLinkInput.value.trim();
    const dueDate = taskDueDateInput.value;

    if (!description) {
        taskMessage.textContent = "Please add a task description.";
        return;
    }

    if (containsHtmlTags(description)) {
        taskMessage.textContent = "Task descriptions cannot contain HTML tags.";
        return;
    }

    if (!dueDate) {
        taskMessage.textContent = "Please choose a due date.";
        return;
    }

    if (parseLocalDate(dueDate) < startOfDay(new Date())) {
        taskMessage.textContent = "The due date cannot be in the past.";
        return;
    }

    const newTask = {
        id: Date.now(),
        description,
        link,
        dueDate,
        completedDate: ""
    };

    plannerState.revisionTasks.push(newTask);
    saveData(storageKeys.revisionTasks, plannerState.revisionTasks);
    taskForm.reset();
    setTodayAsMinDate();
    taskMessage.textContent = "Revision task added.";
    renderEverything();
}


// Rendering revision tasks and sorting it by date.
// HTML generattion is for task card details, status, buttons and events that
// are attatched to change based on what event the user triggers
function renderRevisionTasks() {
    const sortedTasks = [...plannerState.revisionTasks].sort((firstTask, secondTask) => {
        return parseLocalDate(firstTask.dueDate) - parseLocalDate(secondTask.dueDate);
    });

    if (sortedTasks.length === 0) {
        taskList.innerHTML = '<div class="empty-state">No revision tasks added yet.</div>';
        return;
    }

    taskList.innerHTML = sortedTasks.map((task) => {
        const isOverdue = !task.completedDate && parseLocalDate(task.dueDate) < startOfDay(new Date());
        const statusClass = task.completedDate ? "done" : isOverdue ? "overdue" : "pending";
        const statusText = task.completedDate ? `Completed on ${formatDate(task.completedDate)}` : isOverdue ? "Overdue" : "Pending";

        return `
            <article class="task-card">
                <div class="task-top">
                    <div>
                        <h3>${escapeHtml(task.description)}</h3>
                        <p class="task-meta">Due: ${formatDate(task.dueDate)}</p>
                        ${task.link ? `<p class="task-meta"><a href="${escapeAttribute(task.link)}" target="_blank" rel="noopener noreferrer">Open resource</a></p>` : ""}
                    </div>
                    <span class="status-pill ${statusClass}">${statusText}</span>
                </div>
                <div class="task-actions">
                    <span class="task-meta">Actual completion date: ${task.completedDate ? formatDate(task.completedDate) : "Not completed yet"}</span>
                    ${task.completedDate ? "" : `<button class="small-btn" type="button" data-task-id="${task.id}">Mark Complete</button>`}
                </div>
            </article>
        `;
    }).join("");

    document.querySelectorAll("[data-task-id]").forEach((button) => {
        button.addEventListener("click", handleCompleteTaskClick);
    });
}

function handleCompleteTaskClick(event) {
    const taskId = Number(event.currentTarget.dataset.taskId);
    const taskToUpdate = plannerState.revisionTasks.find((task) => task.id === taskId);

    if (!taskToUpdate) {
        return;
    }

    taskToUpdate.completedDate = formatDateForInput(new Date());
    saveData(storageKeys.revisionTasks, plannerState.revisionTasks);
    renderEverything();
}

function renderAssessmentMarks() {
    const groupedModules = getGroupedModules();

    markList.innerHTML = groupedModules.map((moduleData) => {
        const assessmentsMarkup = moduleData.assessments.map((assessment) => {
            const savedMark = plannerState.savedMarks[assessment.id] ?? "";

            return `
                <div class="mark-card">
                    <div class="mark-top">
                        <div>
                            <h3>${escapeHtml(assessment.assessmentName)}</h3>
                            <p class="mark-meta">${escapeHtml(moduleData.moduleName)} | ${assessment.type} | Weighting: ${Math.round(assessment.weighting * 100)}%</p>
                            <p class="mark-meta">Deadline: ${formatDate(assessment.deadline)}</p>
                        </div>
                    </div>
                    <div class="mark-row">
                        <div>
                            <label for="mark-${assessment.id}">Mark (0-100)</label>
                            <input id="mark-${assessment.id}" type="number" min="0" max="100" step="1" value="${savedMark}">
                        </div>
                        <button class="small-btn save-mark-btn" type="button" data-assessment-id="${assessment.id}">Save Mark</button>
                    </div>
                </div>
            `;
        }).join("");

        const moduleResult = calculateModuleGrade(moduleData.assessments);

        return `
            <section class="module-card">
                <div class="module-top">
                    <div>
                        <h3>${escapeHtml(moduleData.moduleName)}</h3>
                        <p class="module-meta">${moduleResult.message}</p>
                    </div>
                    <span class="status-pill ${moduleResult.complete ? "done" : "pending"}">${moduleResult.label}</span>
                </div>
                ${assessmentsMarkup}
            </section>
        `;
    }).join("");

    document.querySelectorAll("[data-assessment-id]").forEach((button) => {
        button.addEventListener("click", handleSaveMarkClick);
    });
}


// Handles the click event for saving a mark for a specific assessment
// Validates the entered mark to ensure it's a whole number between 0 and 100
// saves it to the planner state, persists the data, displays a success message and triggers a re renderr of the UI
function handleSaveMarkClick(event) {
    markMessage.textContent = "";
    const assessmentId = Number(event.currentTarget.dataset.assessmentId);
    const input = document.getElementById(`mark-${assessmentId}`);
    const enteredValue = input.value.trim();

    if (!/^\d+$/.test(enteredValue)) {
        markMessage.textContent = "Marks must be whole numbers between 0 and 100.";
        return;
    }

    const markValue = Number(enteredValue);

    if (markValue < 0 || markValue > 100) {
        markMessage.textContent = "Marks must be whole numbers between 0 and 100.";
        return;
    }

    plannerState.savedMarks[assessmentId] = markValue;
    saveData(storageKeys.savedMarks, plannerState.savedMarks);
    markMessage.textContent = "Mark saved.";
    renderEverything();
}

function handleGoalChange() {
    plannerState.goalMark = Number(goalSelect.value);
    saveData(storageKeys.goalMark, plannerState.goalMark);
    updateGoalProgress();
}

// Handles the progress of certrain goals that is set by the user
function updateGoalProgress() {
    const savedMarkEntries = Object.keys(plannerState.savedMarks);

    if (savedMarkEntries.length === 0) {
        goalProgressFill.style.width = "0%";
        goalSummary.textContent = "Enter some marks to see your progress.";
        return;
    }

    let weightedScore = 0;
    let totalWeighting = 0;

    plannerState.assessments.forEach((assessment) => {
        const savedMark = plannerState.savedMarks[assessment.id];

        if (Number.isInteger(savedMark)) {
            weightedScore += savedMark * assessment.weighting;
            totalWeighting += assessment.weighting;
        }
    });

    const currentAverage = Math.round(weightedScore / totalWeighting);
    const progressPercent = Math.min((currentAverage / plannerState.goalMark) * 100, 100);
    const difference = currentAverage - plannerState.goalMark;

    goalProgressFill.style.width = `${progressPercent}%`;

    if (difference >= 0) {
        goalSummary.textContent = `Current weighted average: ${currentAverage}%. You are ${difference}% above your selected goal.`;
    } else {
        goalSummary.textContent = `Current weighted average: ${currentAverage}%. You are ${Math.abs(difference)}% below your selected goal.`;
    }
}

function getGroupedModules() {
    const moduleMap = {};

    plannerState.assessments.forEach((assessment) => {
        if (!moduleMap[assessment.module]) {
            moduleMap[assessment.module] = [];
        }

        moduleMap[assessment.module].push(assessment);
    });

    return Object.keys(moduleMap).map((moduleName) => {
        return {
            moduleName,
            assessments: moduleMap[moduleName]
        };
    });
}

function calculateModuleGrade(moduleAssessments) {
    let totalWeightedMark = 0;
    let totalCompletedWeighting = 0;

    moduleAssessments.forEach((assessment) => {
        const savedMark = plannerState.savedMarks[assessment.id];

        if (Number.isInteger(savedMark)) {
            totalWeightedMark += savedMark * assessment.weighting;
            totalCompletedWeighting += assessment.weighting;
        }
    });

    if (totalCompletedWeighting === 0) {
        return {
            complete: false,
            label: "Waiting for marks",
            message: "No assessment marks entered yet."
        };
    }

    if (totalCompletedWeighting < 1) {
        return {
            complete: false,
            label: "Partial grade",
            message: `Current weighted module mark: ${Math.round(totalWeightedMark)}% based on entered assessments so far.`
        };
    }

    return {
        complete: true,
        label: "Final module grade",
        message: `Calculated final module mark: ${Math.round(totalWeightedMark)}%.`
    };
}

// Timer Feature

const RING_CIRCUMFERENCE = 2 * Math.PI * 88;

function initializeTimer() {
    plannerState.timer.duration = Number(timerSlider.value) * 60;
    plannerState.timer.remaining = plannerState.timer.duration;
    ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    timerValue.textContent = `${timerSlider.value} min`;
    updateTimerDisplay();
    updateTimerControls();
}

// Handles the length change
function handleTimerLengthChange() {
    if (plannerState.timer.running) {
        return;
    }

    plannerState.timer.duration = Number(timerSlider.value) * 60;
    plannerState.timer.remaining = plannerState.timer.duration;
    timerValue.textContent = `${timerSlider.value} min`;
    updateTimerDisplay();
}

// Function to handle if the button paused or not
function handleTimerButtonClick() {
    if (!plannerState.timer.running) {
        openTimerModal();
        return;
    }

    plannerState.timer.paused = !plannerState.timer.paused;
    updateTimerControls();
    updateTimerDisplay();
}


// Function to handle input from the modal so that the timer starts
function startTimerFromModal() {
    plannerState.timer.duration = Number(timerSlider.value) * 60;
    plannerState.timer.remaining = plannerState.timer.duration;
    plannerState.timer.running = true;
    plannerState.timer.paused = false;
    clearInterval(plannerState.timer.intervalId);
    plannerState.timer.intervalId = setInterval(tickTimer, 1000);
    closeTimerModal();
    updateTimerControls();
    updateTimerDisplay();
}


// Decrements the timer each tick, stops it when it hits zero, plays a sound, and updates the display
function tickTimer() {
    if (plannerState.timer.paused) {
        return;
    }

    plannerState.timer.remaining -= 1;

    if (plannerState.timer.remaining <= 0) {
        plannerState.timer.remaining = 0;
        clearInterval(plannerState.timer.intervalId);
        plannerState.timer.intervalId = null;
        plannerState.timer.running = false;
        plannerState.timer.paused = false;
        playTimerSound();
    }

    updateTimerControls();
    updateTimerDisplay();
}


// Resets the timer to start fresh with the duration from the slider, clearing any running intervals and updating the display
function resetTimer() {
    clearInterval(plannerState.timer.intervalId);
    plannerState.timer.intervalId = null;
    plannerState.timer.running = false;
    plannerState.timer.paused = false;
    plannerState.timer.duration = Number(timerSlider.value) * 60;
    plannerState.timer.remaining = plannerState.timer.duration;
    updateTimerControls();
    updateTimerDisplay();
}

// Updates the focus timer button and label based on the current timer state
function updateTimerControls() {
    if (!plannerState.timer.running) {
        focusToggleButton.textContent = "Start Focus";
        timerLabel.textContent = plannerState.timer.remaining === 0
            ? "Session complete. Start another one when you're ready."
            : "Ready for your next study session.";
        return;
    }

    if (plannerState.timer.paused) {
        focusToggleButton.textContent = "Resume Focus";
        timerLabel.textContent = "Session paused.";
        return;
    }

    focusToggleButton.textContent = "Pause Focus";

    if (plannerState.timer.remaining <= 60) {
        timerLabel.textContent = "Almost there - keep going!";
    } else if (plannerState.timer.remaining <= plannerState.timer.duration / 2) {
        timerLabel.textContent = "Halfway there - stay focused.";
    } else {
        timerLabel.textContent = "Focus session in progress.";
    }
}

function updateTimerDisplay() {
    const totalSeconds = Math.max(plannerState.timer.remaining, 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const progress = plannerState.timer.duration > 0 ? totalSeconds / plannerState.timer.duration : 0;
    const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

    timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    ringProgress.style.strokeDashoffset = String(dashOffset);
}

function openTimerModal() {
    modalOverlay.style.display = "flex";
}

function closeTimerModal() {
    modalOverlay.style.display = "none";
}

function playTimerSound() {
    try {
        const soundContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = soundContext.createOscillator();
        const gain = soundContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gain.gain.value = 0.1;

        oscillator.connect(gain);
        gain.connect(soundContext.destination);

        oscillator.start();
        oscillator.stop(soundContext.currentTime + 0.6);
    } catch (error) {
        return;
    }
}

function setTodayAsMinDate() {
    document.getElementById("task-due-date").min = formatDateForInput(new Date());
}

function containsHtmlTags(text) {
    return /<[^>]+>/.test(text); // checking with regex if a string contains html
}

function loadSavedData(storageKey, fallbackValue) {
    const savedValue = localStorage.getItem(storageKey);

    if (!savedValue) {
        return fallbackValue;
    }

    try {
        return JSON.parse(savedValue);
    } catch (error) {
        return fallbackValue;
    }
}


// Saves data to browser's local storage by converting the value to a JSON string
function saveData(storageKey, valueToSave) {
    localStorage.setItem(storageKey, JSON.stringify(valueToSave));
}

// Parses a date string in "YYYY-MM-DD" format and returns a Date object representing that local date.
function parseLocalDate(dateText) {
    const [year, month, day] = dateText.split("-").map(Number);
    return new Date(year, month - 1, day);
}

// This function converts the date string to a YYY MM DD format then using GB converts to DD MM YYYY
function formatDate(dateText) {
    return parseLocalDate(dateText).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

//Formats a Date object into a string suitable for HTML input fields (YYYY-MM-DD format)
function formatDateForInput(dateObject) {
    const year = dateObject.getFullYear();
    const month = String(dateObject.getMonth() + 1).padStart(2, "0");
    const day = String(dateObject.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}


// Adds a specified number of days to a date object and returns the new date
function addDays(dateObject, daysToAdd) {
    const newDate = new Date(dateObject);
    newDate.setDate(newDate.getDate() + daysToAdd);
    return newDate;
}

//Returns a new Date object set to the start of the day (00:00:00) for the given date
function startOfDay(dateObject) {
    return new Date(dateObject.getFullYear(), dateObject.getMonth(), dateObject.getDate());
}


// Escapes special HTML characters in a string to ensure safe HTML rendering
function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeAttribute(text) {
    return escapeHtml(text);
}
