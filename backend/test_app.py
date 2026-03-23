import unittest

import app as resume_app


class ResumeAnalyzerTests(unittest.TestCase):
    def test_normalize_token_synonyms(self):
        self.assertEqual(resume_app.normalize_token("JS"), "javascript")
        self.assertEqual(resume_app.normalize_token("ml"), "machine-learning")

    def test_extract_phrase_keywords(self):
        text = "Built full stack apps with machine learning and REST API design"
        phrases = resume_app.extract_phrase_keywords(text)
        self.assertIn("full-stack", phrases)
        self.assertIn("machine-learning", phrases)
        self.assertIn("rest-api", phrases)

    def test_section_scores_shape(self):
        resume_text = """
        Summary
        Python engineer with backend skills.
        Skills
        Python SQL Flask REST API
        Experience
        Built API services and optimized queries.
        Projects
        Resume matcher using machine learning.
        Education
        BTech Computer Science
        """
        job_tokens = resume_app.extract_keyword_tokens(
            "Python SQL REST API machine learning backend engineer"
        )
        section_scores = resume_app.calculate_section_scores(resume_text, job_tokens)

        expected_sections = {"summary", "skills", "experience", "projects", "education"}
        self.assertEqual(set(section_scores.keys()), expected_sections)
        for value in section_scores.values():
            self.assertGreaterEqual(value, 0)
            self.assertLessEqual(value, 100)

    def test_checklist_contract(self):
        checklist = resume_app.build_checklist(
            score=72,
            keyword_coverage=48,
            section_scores={"experience": 40},
            missing_keywords=["kubernetes", "docker"],
            resume_text="Summary\nImproved API latency by 20% in production.",
        )

        self.assertIn("completion_percent", checklist)
        self.assertIn("items", checklist)
        self.assertTrue(isinstance(checklist["items"], list))
        self.assertGreaterEqual(checklist["completion_percent"], 0)
        self.assertLessEqual(checklist["completion_percent"], 100)

    def test_validate_request_missing_file(self):
        with resume_app.app.test_request_context(
            "/analyze",
            method="POST",
            data={"job_description": "Python backend role with SQL APIs and testing"},
        ):
            file, job_desc, role_level, years_experience, error_response = resume_app.validate_request()
            self.assertIsNone(file)
            self.assertIsNone(job_desc)
            self.assertIsNotNone(error_response)


if __name__ == "__main__":
    unittest.main()
