using UnrealBuildTool;
using System.Collections.Generic;

public class JetrunnerMapCompilerEditorTarget : TargetRules
{
    public JetrunnerMapCompilerEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;

        ExtraModuleNames.Add("JetrunnerMapCompiler");
    }
}