document.addEventListener('DOMContentLoaded', () => {
	const link = document.getElementById('refresh-book-availability');

	link.addEventListener('click', () => {
		fetch('/refresh', { method: 'POST' }).then(() => {
			link.textContent = `${link.textContent} ✓`;
		});
	});
});
