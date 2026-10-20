# Test build signing

`wxpn-test.jks` signs the **Android test build** (the debug build the Native
apps workflow publishes, and debug builds made locally), so each new test
build installs over the last one. Android only updates an app signed with
the same key.

It is for test builds only. It is in the repository, password `wxpn-test`,
so anyone with the repository can sign a build that installs over a test
build; that is acceptable for staff testing and nothing else. **Never use it
for a store build.** Play builds are signed with the upload key from the
Release workflow's secrets (README › Native apps).
