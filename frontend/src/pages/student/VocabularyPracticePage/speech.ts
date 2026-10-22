/* Pronunciation (ST-15 "play button"). The browser's speech synthesis reads the English word, so
   there is no audio file to load and it works for every word, including ones the student typed in.
   It is a progressive enhancement: where it is missing the play buttons are not shown. */

export function canSpeak(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

export function speakWord(text: string): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}
