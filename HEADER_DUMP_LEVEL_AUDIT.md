# JETRUNNER replacement-level header audit

## Conclusion

The authoring project must not reimplement every function in the header dump. The dump contains reflected declarations, not the original function bodies. In the shipped game, `/Script/JETRUNNER` supplies those implementations.

For a replacement map, the local `JETRUNNER` plugin is an editor/cooking compatibility shim. It needs the correct native class names, inheritance, constructors, and any reflected properties that the map serializes. It only needs `UFUNCTION` declarations when a locally compiled Blueprint directly calls or overrides them.

## Current map dependencies

`Map_Pillars.umap` currently references:

- `/Script/JETRUNNER.SBWorldSettings`
- `/Script/JETRUNNER.SBPlayerStart`
- `/Flashback/Content/Rulesets/TimeTrial/Ruleset_TimeTrial`
- `/Flashback/Content/Rulesets/Common/BP_TimeTrialGoal_Sphere`

Only `DefaultRuleset` is visibly serialized from `ASBWorldSettings`. The player start currently has no visibly serialized JETRUNNER-specific property values.

## Required native shim classes

### `ASBWorldSettings`

Required inheritance: `AWorldSettings`

Required constructor declaration:

```cpp
ASBWorldSettings(const FObjectInitializer& ObjectInitializer);
```

Required reflected properties:

- `TSoftClassPtr<USBRuleset> DefaultRuleset`
- `FPrimaryAssetId MapDisplayData`
- `bool bIsMenuWorld`
- `float EnergyAtStart`
- `int32 WorldStartingPolarity`
- `UJetStoryAsset* JetStoryAsset`
- `bool bIsFlashbackWorld` (protected in the dump)
- `TSoftObjectPtr<UJetLevelDefinition> LevelDefinition` (protected in the dump)

No dumped `UFUNCTION` is required for this class.

### `ASBPlayerStart`

Required inheritance: `APlayerStart`

Required constructor declaration:

```cpp
ASBPlayerStart(const FObjectInitializer& ObjectInitializer);
```

Required reflected properties:

- `FGameplayTag GameModeGameplayTag`
- `FGameplayTag TeamGameplayTag`
- `int32 TeamID`

No dumped `UFUNCTION` is required for this class.

### `USBRuleset`

Required inheritance: `UPrimaryDataAsset` (the current shim incorrectly uses `UObject`).

Required constructor declaration:

```cpp
USBRuleset();
```

The full reflected property layout should be restored if the local ruleset Blueprint is opened or compiled:

- `DevName`
- `PawnData`
- `PawnDataSpectator`
- `GameModeGameplayTag`
- `RulesetDisplayData`
- `DisplayName`
- `InfoWidget`
- `ScoreboardData`
- `BreakScreenWidget`
- `GameRecapWidget`
- `LoadoutScreen`
- `BehaviorTreeOverride`
- `ActionSets`
- `Actions`

No dumped `UFUNCTION` is required for `USBRuleset`.

### `UJetLevelDefinition`

This is not visibly serialized into the current test map, but the current shim has incorrect inheritance. The dump derives it from `UJetExperienceDefinition`, not directly from `UDataAsset`.

If level-definition assets are added later, restore `UJetDataAsset`, `UJetExperienceDefinition`, `FMedalTimeCombo`, and all `UJetLevelDefinition` properties before authoring them. The following inherited functions are only needed if local Blueprints call them:

```cpp
bool IsPlayable() const;
TArray<FMedalTimeCombo> GetMedalTimes() const;
FName GetActualExperienceId() const;
```

Do not invent gameplay behavior for these functions from the declarations alone.

## Functions needed only for locally authored gameplay Blueprints

These are not required merely to serialize the current replacement map. Add their declarations only if a custom local Blueprint calls or overrides them.

### Time-trial goal

From `ATimeTrialGoal`:

```cpp
void TryTriggerGoal(AActor* SourceActor, float TimeDifference);
void OnLockStateChanged(bool bIsUnlocked, bool bIsInitial); // BlueprintImplementableEvent
FVector GetGoalCenter() const;                              // BlueprintNativeEvent
float GetCheckpointRadius() const;                         // BlueprintNativeEvent
```

It also implements `ISBRemoteActivationInterface` and `ISBResettableObject`. The reset interface declares:

```cpp
void ResetObject();
bool CanResetObject() const;
```

### Checkpoint component

From `USBCheckpointComponent`:

```cpp
void TriggerCheckpoint(AActor* Actor, float TimeDifference);
void SetLocked(bool bNewLocked);
void SetActivated(bool bNewActivated, bool bPrimeUnlockers);
void OnRep_Locked();
void OnRep_Activated();
bool IsLocked() const;
bool IsActivated() const;
```

Its replicated fields and three multicast delegates are also required if this component is reconstructed locally.

### Time-trial game component

From `USBGameComponent_TimeTrial`:

```cpp
void StartTrial();
void ResetTrial(bool bForceReset);
void RemoveResetLock(FName LockId);
void OnCheckpointTriggered(USBCheckpointComponent* Checkpoint, AActor* Actor, float TimeDifference);
bool IsTimerRunning() const;
bool IsFirstTry() const;
int32 GetNumTargets() const;
int32 GetNumActiveTargets() const;
double GetElapsedTime() const;
void FinishTrial(float TimeDifference);
void BP_OnStartTrial();  // BlueprintImplementableEvent
void BP_OnResetTrial();  // BlueprintImplementableEvent
void BP_OnFinishTrial(); // BlueprintImplementableEvent
void AddResetLock(FName LockId);
```

This component belongs to the game's game-state/ruleset pipeline and should normally be supplied by the installed game, not placed manually in a map.

## Functions not required for the first replacement-map milestone

The functions in these systems are game runtime infrastructure and should remain supplied by the game:

- `ASBGameMode`
- `USBGameModeFunctionLibrary`
- `ASBGameState`
- `USBRulesetManagerComponent`
- `UTimeTrialManager`
- campaign/world progression assets
- UI, medals, story, save data, analytics, weapons, abilities, and player movement

They should only be stubbed later when a specific asset fails to load or a locally compiled Blueprint has a verified dependency on one of them.

## Packaging warning

The local ruleset and goal assets use the same `/Flashback/...` package paths as game assets. If placeholder versions are included in the final mod package, they may overwrite the game's working ruleset/goal assets with incomplete copies. The eventual packaging pipeline should include the replacement `.umap` and newly authored assets, while relying on unchanged base-game assets wherever possible.

## First playable-map asset checklist

The first test map should contain:

1. `ASBWorldSettings` with the original time-trial ruleset reference.
2. At least one `ASBPlayerStart`, positioned clear of collision.
3. Traversable collision geometry.
4. The original `BP_TimeTrialGoal_Sphere` class at a reachable finish location.
5. Lighting only if the original level does not supply it through a streamed setup.
6. No generic runtime-loader or marker actors in the final in-game map unless their Blueprint dependencies are deliberately packaged and proven to run in JETRUNNER.

The next validation should be a map-only cook/install test, followed by reading the game log for missing imports, class mismatches, and asset-path failures.
