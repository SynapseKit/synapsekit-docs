import React from 'react';
import { Sandpack } from '@codesandbox/sandpack-react';
import { synapsekitMockCode } from './mocks/synapsekit';
import styles from './Playground.module.css';

interface PlaygroundProps {
  /** The code to display and run in the playground */
  code: string;
  /** Optional title above the playground */
  title?: string;
  /** Height of the editor */
  height?: number;
}

export default function Playground({
  code,
  title = "Try it live",
  height = 420,
}: PlaygroundProps) {
  return (
    <div className={styles.container}>
      {title && <div className={styles.title}>{title}</div>}

      <Sandpack
        template="react-ts"
        files={{
          '/App.tsx': {
            code: code,
            active: true,
          },
          '/mocks/synapsekit.ts': {
            code: synapsekitMockCode,
          },
        }}
        options={{
          showNavigator: false,
          showTabs: true,
          editorHeight: height,
          wrapContent: true,
        }}
      />
    </div>
  );
}
