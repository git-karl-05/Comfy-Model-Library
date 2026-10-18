window.OutputDateGroups = (() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    function groups(entries, counts = {}, now = new Date(), ascending = false) {
        const today = key(now), previous = new Date(now);
        previous.setDate(previous.getDate() - 1);
        const yesterday = key(previous), result = new Map();
        for (const entry of entries) {
            if (entry.directory) continue;
            const date = new Date(entry.created ?? entry.modified ?? 0), day = key(date);
            if (!result.has(day)) result.set(day, {day, label: day === today ? "Today" : day === yesterday ? "Yesterday"
                : date.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}), entries: []});
            result.get(day).entries.push(entry);
        }
        return [...result.values()].sort((a, b) => ascending ? a.day.localeCompare(b.day) : b.day.localeCompare(a.day))
            .map(group => ({...group, count: counts[group.day] ?? group.entries.length}));
    }
    return {timeZone, groups};
})();
