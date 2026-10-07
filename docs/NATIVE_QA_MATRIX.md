# Native QA evidence

The release gate does not accept `NATIVE_QA_SIGNOFF=true` by itself. Before release, test one supported Android device and one supported iOS device using the same development or release candidate build, save the evidence JSON at `NATIVE_QA_EVIDENCE_PATH`, and set the sign-off flag only after review.

Each record must include the device, OS version, build identifier, ISO test timestamp, and a `pass` result for every check below:

| Check | Required observation |
| --- | --- |
| `microphone` | Permission, input level, and stop behavior work. |
| `playback` | Prompt and local recording play clearly; silent-mode behavior is understood. |
| `backgroundInterruption` | Call, notification, lock, background, and app termination settle safely. |
| `screenReader` | Labels, headings, controls, and status updates are understandable. |
| `textScaling` | Large text does not hide controls or overflow critical content. |
| `reducedMotion` | OS setting disables nonessential transitions, press feedback, and waveform motion. |
| `keyboard` | Focused fields remain visible and the form can be dismissed or scrolled. |

Use this shape as a starting point, replacing every value with observed evidence:

```json
[
  {
    "platform": "android",
    "device": "replace-with-device",
    "osVersion": "replace-with-version",
    "buildId": "replace-with-build-id",
    "testedAt": "2026-10-06T10:00:00.000Z",
    "checks": {
      "microphone": "pass",
      "playback": "pass",
      "backgroundInterruption": "pass",
      "screenReader": "pass",
      "textScaling": "pass",
      "reducedMotion": "pass",
      "keyboard": "pass"
    }
  },
  {
    "platform": "ios",
    "device": "replace-with-device",
    "osVersion": "replace-with-version",
    "buildId": "replace-with-build-id",
    "testedAt": "2026-10-06T10:00:00.000Z",
    "checks": {
      "microphone": "pass",
      "playback": "pass",
      "backgroundInterruption": "pass",
      "screenReader": "pass",
      "textScaling": "pass",
      "reducedMotion": "pass",
      "keyboard": "pass"
    }
  }
]
```
