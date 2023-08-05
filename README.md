# Token State API

An API for Roll20.net to enable the automatic caching of tokens, their positions, and specific token attributes.

The goal of this project is to have an api that replicates the inbuilt functions provided by Roll20 for getting game data, with the added benefit of a cache for all results and keeps them updated based on game events.

This runs on all pages that have at least 1 current player, and only stores variables that are inspected by other APIs to avoid bloating.
