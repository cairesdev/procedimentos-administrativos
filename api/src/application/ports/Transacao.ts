import type { PoolClient } from "pg";

export type Tx = PoolClient;

export type ExecutorDeTransacao = <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
