import { DateTime } from 'luxon';

interface LastCheckedProps {
	lastChecked?: Date | null;
}

export function Status({ lastChecked }: LastCheckedProps) {
	return (
		<div className="status">
			{lastChecked && (
				<span className="last-checked">
					Zuletzt aktualisiert&nbsp;
					{DateTime.fromJSDate(lastChecked).toRelative({
						locale: 'de',
					})}
					.
				</span>
			)}

			{/* biome-ignore lint/a11y/useValidAnchor: <explanation> */}
			<a id="refresh-book-availability">Aktualisieren</a>
		</div>
	);
}
