/**
 * Served in place of `react-native-reanimated/mock` via jest `moduleNameMapper`. The official
 * mock boots the real module and throws under Jest (Reanimated 4.7), and `expo-router`'s testing
 * library hard-codes `require('react-native-reanimated/mock')` in its own `jest.mock` factory, so
 * swapping the file is the one place that fixes both paths.
 */
import { reanimatedMock } from './reanimatedMock';

module.exports = reanimatedMock();
