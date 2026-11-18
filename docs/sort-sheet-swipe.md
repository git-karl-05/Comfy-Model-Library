# Gallery sorting and bottom sheets

Reset Sort clears the sort field and direction, resets pagination, and restores
the backend's default order. Search, filters, and favorites remain applied.
Reset is disabled when no sort is selected. Selecting a sort after resetting
starts in ascending order.

`sheet-swipe.js` handles downward touch dismissal. It ignores interactive controls
and horizontal gestures, respects scroll position, and returns short or cancelled
drags to their starting position. Closing details pauses video and clears gesture
state; reopening restores the sheet to the top.
