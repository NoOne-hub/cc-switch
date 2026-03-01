use std::fs;

use cc_switch_lib::{
    update_settings, AppSettings, AppType, SkillService, SkillSsotMode, SyncMethod,
};

#[path = "support.rs"]
mod support;
use support::{create_test_state, ensure_test_home, reset_test_fs, test_mutex};

fn write_minimal_skill(path: &std::path::Path) {
    fs::create_dir_all(path).expect("create skill dir");
    fs::write(path.join("SKILL.md"), "---\nname: demo\ndescription: demo\n---\n")
        .expect("write SKILL.md");
}

#[test]
fn ssot_auto_prefers_agents_dir_when_present() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let home = ensure_test_home();

    fs::create_dir_all(home.join(".agents").join("skills")).expect("create agents skills dir");

    update_settings(AppSettings::default()).expect("reset settings");
    let dir = SkillService::get_ssot_dir().expect("resolve ssot dir");

    assert_eq!(dir, home.join(".agents").join("skills"));
}

#[test]
fn ssot_can_force_ccswitch_dir_even_when_agents_exists() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let home = ensure_test_home();
    fs::create_dir_all(home.join(".agents").join("skills")).expect("create agents skills dir");

    let mut settings = AppSettings::default();
    settings.skill_ssot_mode = SkillSsotMode::Ccswitch;
    update_settings(settings).expect("set ccswitch mode");

    let dir = SkillService::get_ssot_dir().expect("resolve ssot dir");
    assert_eq!(dir, home.join(".cc-switch").join("skills"));
}

#[test]
fn shared_agents_mode_disallows_copy_sync() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let home = ensure_test_home();

    let skill_dir = home.join(".agents").join("skills").join("demo-skill");
    write_minimal_skill(&skill_dir);

    let mut settings = AppSettings::default();
    settings.skill_ssot_mode = SkillSsotMode::Agents;
    settings.skill_sync_method = SyncMethod::Copy;
    update_settings(settings).expect("set shared agents + copy mode");

    let err = SkillService::sync_to_app_dir("demo-skill", &AppType::Claude)
        .expect_err("copy should be blocked in shared mode");
    let msg = err.to_string();
    assert!(
        msg.contains("不允许 Copy 同步"),
        "unexpected error: {msg}"
    );

    assert!(
        !home.join(".claude").join("skills").join("demo-skill").exists(),
        "should not create copied skill under app directory"
    );
}

#[test]
fn uninstall_keeps_agents_source_directory_in_shared_mode() {
    let _guard = test_mutex().lock().expect("acquire test mutex");
    reset_test_fs();
    let home = ensure_test_home();

    let mut settings = AppSettings::default();
    settings.skill_ssot_mode = SkillSsotMode::Agents;
    update_settings(settings).expect("set shared agents mode");

    let skill_dir = home.join(".agents").join("skills").join("demo-skill");
    write_minimal_skill(&skill_dir);

    let state = create_test_state().expect("create test state");
    let imported = SkillService::import_from_apps(&state.db, vec!["demo-skill".to_string()])
        .expect("import skill from apps");
    assert_eq!(imported.len(), 1, "should import exactly one skill");

    let skill_id = imported[0].id.clone();
    SkillService::uninstall(&state.db, &skill_id).expect("uninstall skill");

    assert!(
        skill_dir.exists(),
        "shared agents source should be kept after uninstall"
    );
    assert!(
        state
            .db
            .get_installed_skill(&skill_id)
            .expect("query skill")
            .is_none(),
        "db record should be removed"
    );
}
