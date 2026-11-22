package itgeo.report;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;

import itgeo.to.AiReportTO;

/**
 * AI 현장 확인보고서 → PDF (openhtmltopdf). 내용은 ReportHtml.document 와 같다.
 * 한글 글꼴(.ttf) 이 있어야 한다. 찾는 순서
 *   1) app.report.font-path (.ttf 파일 경로)
 *   2) Windows 맑은 고딕 (C:/Windows/Fonts/malgun.ttf, 굵게 malgunbd.ttf)
 *   3) 나눔고딕 (Windows · macOS · Linux 의 흔한 설치 위치)
 * .ttc(글꼴 모음) 파일은 쓸 수 없다.
 */
@Component
public class PdfReportWriter {

	static final String FONT = "ReportFont";

	@Value("${app.report.font-path:}")
	String fontPath;

	public byte[] write(AiReportTO rp) {
		File[] font = findFont();
		if (font == null) throw new IllegalStateException("PDF 에 쓸 한글 글꼴(.ttf)을 찾지 못했습니다. app.properties 의 app.report.font-path 에 글꼴 파일 경로를 적어 주세요.");
		try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
			PdfRendererBuilder b = new PdfRendererBuilder();
			b.useFastMode();
			b.useFont(font[0], FONT, 400, PdfRendererBuilder.FontStyle.NORMAL, true);
			b.useFont(font[1] != null ? font[1] : font[0], FONT, 700, PdfRendererBuilder.FontStyle.NORMAL, true);
			b.withHtmlContent(ReportHtml.document(rp, FONT), null);
			b.withProducer("ITGEO");
			b.toStream(os);
			b.run();
			return os.toByteArray();
		} catch (Exception e) {
			throw new IllegalStateException("PDF 를 만들지 못했습니다. (" + e.getClass().getSimpleName() + ")");
		}
	}

	/** [보통, 굵게(없으면 null)]. 하나도 없으면 null */
	File[] findFont() {
		if (fontPath != null && !fontPath.isBlank()) {
			File f = new File(fontPath.trim());
			if (f.isFile()) return new File[] { f, null };
		}
		List<String[]> cands = new ArrayList<>();
		cands.add(new String[] { "C:/Windows/Fonts/malgun.ttf", "C:/Windows/Fonts/malgunbd.ttf" });
		cands.add(new String[] { "C:/Windows/Fonts/NanumGothic.ttf", "C:/Windows/Fonts/NanumGothicBold.ttf" });
		cands.add(new String[] { System.getProperty("user.home") + "/AppData/Local/Microsoft/Windows/Fonts/NanumGothic.ttf", System.getProperty("user.home") + "/AppData/Local/Microsoft/Windows/Fonts/NanumGothicBold.ttf" });
		cands.add(new String[] { "/Library/Fonts/NanumGothic.ttf", "/Library/Fonts/NanumGothicBold.ttf" });
		cands.add(new String[] { System.getProperty("user.home") + "/Library/Fonts/NanumGothic.ttf", System.getProperty("user.home") + "/Library/Fonts/NanumGothicBold.ttf" });
		cands.add(new String[] { "/usr/share/fonts/truetype/nanum/NanumGothic.ttf", "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf" });
		cands.add(new String[] { "/usr/share/fonts/nanum/NanumGothic.ttf", "/usr/share/fonts/nanum/NanumGothicBold.ttf" });
		for (String[] c : cands) {
			File r = new File(c[0]);
			if (r.isFile()) {
				File bd = new File(c[1]);
				return new File[] { r, bd.isFile() ? bd : null };
			}
		}
		return null;
	}
}
