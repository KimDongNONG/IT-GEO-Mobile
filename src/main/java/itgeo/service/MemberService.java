package itgeo.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import itgeo.dao.MemberDAO;
import itgeo.to.MemberTO;

@Service
public class MemberService {

	@Autowired
	MemberDAO dao;

	// 로그인 ID · 비밀번호(평문 비교, 중간점검용)가 맞으면 사용자(비밀번호 비움) 리턴, 아니면 null
	public MemberTO login(String loginId, String pw) {
		if (loginId == null || pw == null) {
			return null;
		}
		MemberTO member = dao.getMemberByLoginId(loginId.trim());
		if (member == null || !pw.equals(member.getPasswordHash())) {
			return null;
		}
		member.setPasswordHash(null); // 세션에 비밀번호는 담지 않는다
		return member;
	}

	// user_id 로 1명 (비밀번호 비움, 없으면 null). 05 인수인계 받는 담당자 확인용
	public MemberTO getMember(long userId) {
		MemberTO m = dao.getMember(userId);
		if (m != null) m.setPasswordHash(null);
		return m;
	}

	// 로그인 ID 로 1명 (비밀번호 비움, 없으면 null). 모바일 현장조사기록 수신 때 보낸 사람 찾기용
	public MemberTO findByLoginId(String loginId) {
		if (loginId == null || loginId.isBlank()) return null;
		MemberTO m = dao.getMemberByLoginId(loginId.trim());
		if (m != null) m.setPasswordHash(null);
		return m;
	}

	// 05 인수인계 받는 담당자 후보 (같은 구, 비밀번호 비움)
	public List<MemberTO> getUserList(String sggCd) {
		List<MemberTO> list = dao.getUserList(sggCd);
		for (MemberTO m : list) m.setPasswordHash(null);
		return list;
	}
}
